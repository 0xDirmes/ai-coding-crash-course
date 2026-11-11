import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { unionAll, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "~/db";
import {
  CourseStatus,
  courseRatings,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  modules,
  purchases,
  quizAttempts,
  quizzes,
  videoWatchEvents,
} from "~/db/schema";
import {
  ANALYTICS_RANGE_DAYS,
  type AnalyticsRange,
} from "~/lib/analytics-range";

// ─── Analytics Service ───
// Instructor dashboard metrics. One entry point: getInstructorAnalytics.
// Each metric has its own query helper returning a per-course map; the entry
// point assembles them into CourseAnalytics and derives AnalyticsTotals.

/** Share of gross sales the platform keeps. Earnings = gross × (1 − rate). */
const PLATFORM_FEE_RATE = 0.2;

const DAY_MS = 86_400_000;

/** Stats for one course. Money is in cents. */
export interface CourseAnalytics {
  courseId: number;
  grossSales: number;
  earnings: number;
  enrollmentCount: number;
  completedCount: number;
  /** completedCount ÷ enrollmentCount, or null with no enrollments. */
  completionRate: number | null;
  neverStartedCount: number;
  droppedOffCount: number;
  /** Sum of all stars, kept so totals can weight by rating count. */
  ratingStars: number;
  ratingCount: number;
  /** ratingStars ÷ ratingCount, unrounded; null when there are no ratings. */
  averageRating: number | null;
}

/**
 * Stats across all of the instructor's courses. Money is in cents.
 * completionRate is recomputed from summed counts (not averaged per course);
 * averageRating is weighted by count (total stars ÷ total ratings).
 */
export type AnalyticsTotals = Omit<CourseAnalytics, "courseId">;

export interface InstructorAnalytics {
  courses: CourseAnalytics[];
  totals: AnalyticsTotals;
}

/**
 * Analytics for an instructor's published and archived courses (drafts are
 * excluded). `range` scopes each metric to rows dated on or after
 * `now − range`; `now` is injected so results are deterministic.
 */
export function getInstructorAnalytics(
  instructorId: number,
  range: AnalyticsRange,
  now: Date
): InstructorAnalytics {
  const courseIds = getAnalyticsCourseIds(instructorId);
  const cutoff = rangeCutoff(range, now);

  const grossSales = getGrossSalesByCourse(courseIds, cutoff);
  const enrollmentCounts = getEnrollmentCountsByCourse(courseIds, cutoff);
  const engagement = getCohortEngagementByCourse(courseIds, cutoff, now);
  const ratings = getRatingsByCourse(courseIds, cutoff);

  const courseStats = courseIds.map((courseId): CourseAnalytics => {
    const gross = grossSales.get(courseId) ?? 0;
    return {
      courseId,
      grossSales: gross,
      earnings: earningsFromGross(gross),
      enrollmentCount: enrollmentCounts.get(courseId) ?? 0,
      ...cohortStats(engagement.get(courseId)),
      ...ratingStats(ratings.get(courseId)),
    };
  });

  return { courses: courseStats, totals: buildTotals(courseStats) };
}

function buildTotals(courseStats: CourseAnalytics[]): AnalyticsTotals {
  const sum = (pick: (c: CourseAnalytics) => number) =>
    courseStats.reduce((total, c) => total + pick(c), 0);

  const enrollmentCount = sum((c) => c.enrollmentCount);
  const completedCount = sum((c) => c.completedCount);

  return {
    grossSales: sum((c) => c.grossSales),
    earnings: sum((c) => c.earnings),
    enrollmentCount,
    completedCount,
    completionRate: completionRate(completedCount, enrollmentCount),
    neverStartedCount: sum((c) => c.neverStartedCount),
    droppedOffCount: sum((c) => c.droppedOffCount),
    ...ratingStats({
      stars: sum((c) => c.ratingStars),
      count: sum((c) => c.ratingCount),
    }),
  };
}

function ratingStats(ratings: { stars: number; count: number } | undefined) {
  const stars = ratings?.stars ?? 0;
  const count = ratings?.count ?? 0;
  return {
    ratingStars: stars,
    ratingCount: count,
    averageRating: count === 0 ? null : stars / count,
  };
}

function earningsFromGross(grossCents: number) {
  return Math.round(grossCents * (1 - PLATFORM_FEE_RATE));
}

// ─── Range ───

/** ISO cutoff for the range, or null for "all". */
function rangeCutoff(range: AnalyticsRange, now: Date): string | null {
  if (range === "all") return null;
  return new Date(now.getTime() - ANALYTICS_RANGE_DAYS[range] * DAY_MS).toISOString();
}

/** `column >= cutoff`, or no condition when the range is "all". */
function onOrAfter(column: SQLiteColumn, cutoff: string | null): SQL | undefined {
  return cutoff === null ? undefined : gte(column, cutoff);
}

// ─── Metric queries ───

function getAnalyticsCourseIds(instructorId: number) {
  return db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.instructorId, instructorId),
        inArray(courses.status, [CourseStatus.Published, CourseStatus.Archived])
      )
    )
    .orderBy(courses.id)
    .all()
    .map((c) => c.id);
}

/** Sum of amountPaid (cents) per course, filtered on purchase date. */
function getGrossSalesByCourse(courseIds: number[], cutoff: string | null) {
  const rows = db
    .select({
      courseId: purchases.courseId,
      total: sql<number>`coalesce(sum(${purchases.amountPaid}), 0)`,
    })
    .from(purchases)
    .where(
      and(
        inArray(purchases.courseId, courseIds),
        onOrAfter(purchases.createdAt, cutoff)
      )
    )
    .groupBy(purchases.courseId)
    .all();
  return new Map(rows.map((r) => [r.courseId, r.total]));
}

/** Enrollment rows per course, filtered on enrollment date. */
function getEnrollmentCountsByCourse(courseIds: number[], cutoff: string | null) {
  const rows = db
    .select({
      courseId: enrollments.courseId,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.courseId, courseIds),
        onOrAfter(enrollments.enrolledAt, cutoff)
      )
    )
    .groupBy(enrollments.courseId)
    .all();
  return new Map(rows.map((r) => [r.courseId, r.count]));
}

/** Star total and rating count per course, filtered on rating creation date. */
function getRatingsByCourse(courseIds: number[], cutoff: string | null) {
  const rows = db
    .select({
      courseId: courseRatings.courseId,
      stars: sql<number>`coalesce(sum(${courseRatings.rating}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(
      and(
        inArray(courseRatings.courseId, courseIds),
        onOrAfter(courseRatings.createdAt, cutoff)
      )
    )
    .groupBy(courseRatings.courseId)
    .all();
  return new Map(rows.map((r) => [r.courseId, { stars: r.stars, count: r.count }]));
}

// ─── Cohort engagement (completion, never started, dropped off) ───

/** Days without activity before a started student counts as dropped off. */
const INACTIVITY_DAYS = 30;

interface CohortEngagement {
  enrolled: number;
  completed: number;
  neverStarted: number;
  droppedOff: number;
}

function cohortStats(engagement: CohortEngagement | undefined) {
  const enrolled = engagement?.enrolled ?? 0;
  const completed = engagement?.completed ?? 0;
  return {
    completedCount: completed,
    completionRate: completionRate(completed, enrolled),
    neverStartedCount: engagement?.neverStarted ?? 0,
    droppedOffCount: engagement?.droppedOff ?? 0,
  };
}

function completionRate(completed: number, enrolled: number) {
  return enrolled === 0 ? null : completed / enrolled;
}

/**
 * Per course, how the enrollment cohort (filtered on enrolledAt) is doing.
 * Never started: no activity on the course at all. Dropped off: not
 * completed, has dated activity, but none in the INACTIVITY_DAYS before `now`
 * (fixed, whatever the range).
 */
function getCohortEngagementByCourse(
  courseIds: number[],
  cutoff: string | null,
  now: Date
) {
  const inactiveBefore = new Date(
    now.getTime() - INACTIVITY_DAYS * DAY_MS
  ).toISOString();
  const cohort = db
    .select({
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      completedAt: enrollments.completedAt,
    })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.courseId, courseIds),
        onOrAfter(enrollments.enrolledAt, cutoff)
      )
    )
    .all();
  const activity = getActivityByStudentCourse(courseIds);

  const byCourse = new Map<number, CohortEngagement>();
  for (const e of cohort) {
    const stats = byCourse.get(e.courseId) ?? {
      enrolled: 0,
      completed: 0,
      neverStarted: 0,
      droppedOff: 0,
    };
    stats.enrolled += 1;
    if (e.completedAt !== null) stats.completed += 1;
    const key = activityKey(e.userId, e.courseId);
    const latest = activity.get(key) ?? null;
    if (!activity.has(key)) {
      stats.neverStarted += 1;
    } else if (
      e.completedAt === null &&
      latest !== null &&
      latest < inactiveBefore
    ) {
      stats.droppedOff += 1;
    }
    byCourse.set(e.courseId, stats);
  }
  return byCourse;
}

function activityKey(userId: number, courseId: number) {
  return `${userId}:${courseId}`;
}

/**
 * Activity per (student, course) from lesson progress, video watch events and
 * quiz attempts on the course's lessons, keyed by activityKey. A key is present
 * once the student has any activity (even an undated in-progress lesson); its
 * value is the latest dated activity, or null when nothing is dated.
 */
function getActivityByStudentCourse(courseIds: number[]) {
  // Each source as (userId, lessonId, at) rows, combined into one stream.
  const events = unionAll(
    db
      .select({
        userId: sql<number>`${lessonProgress.userId}`.as("user_id"),
        lessonId: sql<number>`${lessonProgress.lessonId}`.as("lesson_id"),
        at: sql<string | null>`${lessonProgress.completedAt}`.as("at"),
      })
      .from(lessonProgress),
    db
      .select({
        userId: sql<number>`${videoWatchEvents.userId}`.as("user_id"),
        lessonId: sql<number>`${videoWatchEvents.lessonId}`.as("lesson_id"),
        at: sql<string | null>`${videoWatchEvents.createdAt}`.as("at"),
      })
      .from(videoWatchEvents),
    db
      .select({
        userId: sql<number>`${quizAttempts.userId}`.as("user_id"),
        lessonId: sql<number>`${quizzes.lessonId}`.as("lesson_id"),
        at: sql<string | null>`${quizAttempts.attemptedAt}`.as("at"),
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
  ).as("activity_events");

  const rows = db
    .select({
      userId: events.userId,
      courseId: modules.courseId,
      latest: sql<string | null>`max(${events.at})`,
    })
    .from(events)
    .innerJoin(lessons, eq(events.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(sql`${events.userId}`, modules.courseId)
    .all();

  return new Map(rows.map((r) => [activityKey(r.userId, r.courseId), r.latest]));
}
