import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import { getInstructorAnalytics } from "./analyticsService";
import { parseAnalyticsRange } from "~/lib/analytics-range";
import { createTeamPurchase } from "./purchaseService";
import { redeemCoupon } from "./couponService";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const DAY_MS = 86_400_000;

function daysBefore(days: number, extraMs = 0) {
  return new Date(NOW.getTime() - days * DAY_MS + extraMs).toISOString();
}

let userCounter = 0;
function createStudent() {
  userCounter += 1;
  return testDb
    .insert(schema.users)
    .values({
      name: `Student ${userCounter}`,
      email: `student${userCounter}@example.com`,
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
}

function createCourse(
  instructorId: number,
  status: schema.CourseStatus,
  slug: string,
  price = 0
) {
  return testDb
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: "desc",
      salesCopy: "copy",
      instructorId,
      categoryId: base.category.id,
      status,
      price,
    })
    .returning()
    .get();
}

function purchase(courseId: number, amountPaid: number, createdAt = daysBefore(1)) {
  const student = createStudent();
  return testDb
    .insert(schema.purchases)
    .values({ userId: student.id, courseId, amountPaid, country: "US", createdAt })
    .returning()
    .get();
}

function enroll(courseId: number, enrolledAt = daysBefore(1)) {
  const student = createStudent();
  return testDb
    .insert(schema.enrollments)
    .values({ userId: student.id, courseId, enrolledAt })
    .returning()
    .get();
}

function statsFor(
  analytics: ReturnType<typeof getInstructorAnalytics>,
  courseId: number
) {
  const stats = analytics.courses.find((c) => c.courseId === courseId);
  if (!stats) throw new Error(`No stats for course ${courseId}`);
  return stats;
}

describe("getInstructorAnalytics", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("earnings and gross sales", () => {
    it("sums the amount actually paid and takes the 20% platform fee off it", () => {
      testDb
        .update(schema.courses)
        .set({ price: 10000 })
        .run();
      purchase(base.course.id, 5000); // PPP-discounted from 10000
      purchase(base.course.id, 2500);

      const analytics = getInstructorAnalytics(base.instructor.id, "all", NOW);

      const stats = statsFor(analytics, base.course.id);
      expect(stats.grossSales).toBe(7500);
      expect(stats.earnings).toBe(6000);
    });

    it("counts a team purchase once, at the amount the team paid", () => {
      createTeamPurchase(base.user.id, base.course.id, 30000, "US", 5);

      const analytics = getInstructorAnalytics(base.instructor.id, "all", NOW);

      const stats = statsFor(analytics, base.course.id);
      expect(stats.grossSales).toBe(30000);
      expect(stats.earnings).toBe(24000);
    });
  });

  describe("enrollments", () => {
    it("counts enrollment rows, not unredeemed team coupons", () => {
      const { coupons } = createTeamPurchase(
        base.user.id,
        base.course.id,
        30000,
        "US",
        3
      );
      const redeemer = createStudent();
      const result = redeemCoupon(coupons[0].code, redeemer.id, "US");
      expect(result.ok).toBe(true);
      enroll(base.course.id);

      const analytics = getInstructorAnalytics(base.instructor.id, "all", NOW);

      expect(statsFor(analytics, base.course.id).enrollmentCount).toBe(2);
    });
  });

  describe("course scope", () => {
    it("includes published and archived courses, excludes drafts and other instructors' courses", () => {
      const archived = createCourse(
        base.instructor.id,
        schema.CourseStatus.Archived,
        "archived"
      );
      const draft = createCourse(
        base.instructor.id,
        schema.CourseStatus.Draft,
        "draft"
      );
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const othersCourse = createCourse(
        otherInstructor.id,
        schema.CourseStatus.Published,
        "others"
      );
      for (const course of [base.course, archived, draft, othersCourse]) {
        purchase(course.id, 1000);
        enroll(course.id);
      }

      const analytics = getInstructorAnalytics(base.instructor.id, "all", NOW);

      expect(analytics.courses.map((c) => c.courseId).sort()).toEqual(
        [base.course.id, archived.id].sort()
      );
      expect(analytics.totals.grossSales).toBe(2000);
      expect(analytics.totals.earnings).toBe(1600);
      expect(analytics.totals.enrollmentCount).toBe(2);
    });
  });

  describe("empty instructor", () => {
    it("returns zeros for a course with no sales or enrollments", () => {
      const analytics = getInstructorAnalytics(base.instructor.id, "all", NOW);

      expect(analytics.courses).toMatchObject([
        {
          courseId: base.course.id,
          grossSales: 0,
          earnings: 0,
          enrollmentCount: 0,
        },
      ]);
      expect(analytics.totals).toMatchObject({
        grossSales: 0,
        earnings: 0,
        enrollmentCount: 0,
      });
    });

    it("returns no courses and zero totals for an instructor with no courses", () => {
      const newInstructor = testDb
        .insert(schema.users)
        .values({
          name: "New",
          email: "new@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const analytics = getInstructorAnalytics(newInstructor.id, "all", NOW);

      expect(analytics.courses).toEqual([]);
      expect(analytics.totals.grossSales).toBe(0);
      expect(analytics.totals.earnings).toBe(0);
      expect(analytics.totals.enrollmentCount).toBe(0);
    });
  });

  describe("time range", () => {
    it.each([
      ["7d", 7],
      ["30d", 30],
      ["90d", 90],
    ] as const)(
      "%s counts purchases made on or after the cutoff",
      (range, days) => {
        purchase(base.course.id, 1000, daysBefore(days)); // exactly at cutoff
        purchase(base.course.id, 200, daysBefore(days, 1)); // just inside
        purchase(base.course.id, 30, daysBefore(days, -1)); // just outside

        const analytics = getInstructorAnalytics(base.instructor.id, range, NOW);

        expect(statsFor(analytics, base.course.id).grossSales).toBe(1200);
        expect(analytics.totals.grossSales).toBe(1200);
      }
    );

    it.each([
      ["7d", 7],
      ["30d", 30],
      ["90d", 90],
    ] as const)(
      "%s counts students who enrolled on or after the cutoff",
      (range, days) => {
        enroll(base.course.id, daysBefore(days));
        enroll(base.course.id, daysBefore(days, 1));
        enroll(base.course.id, daysBefore(days, -1));

        const analytics = getInstructorAnalytics(base.instructor.id, range, NOW);

        expect(statsFor(analytics, base.course.id).enrollmentCount).toBe(2);
        expect(analytics.totals.enrollmentCount).toBe(2);
      }
    );

    it("all counts every purchase and enrollment regardless of age", () => {
      purchase(base.course.id, 1000, "2015-01-01T00:00:00.000Z");
      purchase(base.course.id, 500, daysBefore(1));
      enroll(base.course.id, "2015-01-01T00:00:00.000Z");
      enroll(base.course.id, daysBefore(1));

      const analytics = getInstructorAnalytics(base.instructor.id, "all", NOW);

      const stats = statsFor(analytics, base.course.id);
      expect(stats.grossSales).toBe(1500);
      expect(stats.enrollmentCount).toBe(2);
    });
  });

  describe("parseAnalyticsRange", () => {
    it("accepts the known ranges and falls back to all otherwise", () => {
      expect(parseAnalyticsRange("7d")).toBe("7d");
      expect(parseAnalyticsRange("30d")).toBe("30d");
      expect(parseAnalyticsRange("90d")).toBe("90d");
      expect(parseAnalyticsRange("all")).toBe("all");
      expect(parseAnalyticsRange(null)).toBe("all");
      expect(parseAnalyticsRange("365d")).toBe("all");
    });
  });
});
