import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "~/db";
import {
  CourseStatus,
  courseRatings,
  courses,
  enrollments,
  purchases,
} from "~/db/schema";
import {
  ANALYTICS_RANGE_DAYS,
  type AnalyticsRange,
} from "~/lib/analytics-range";

export type { AnalyticsRange };

// ─── Analytics Service ───
// Instructor dashboard metrics. One entry point: getInstructorAnalytics.
// Each metric has its own query helper returning a per-course map; the entry
// point assembles them into CourseAnalytics and derives AnalyticsTotals.

/** Share of gross sales the platform keeps. Earnings = gross × (1 − rate). */
export const PLATFORM_FEE_RATE = 0.2;

const DAY_MS = 86_400_000;

/** Stats for one course. Money is in cents. */
export interface CourseAnalytics {
  courseId: number;
  grossSales: number;
  earnings: number;
  enrollmentCount: number;
  /** Sum of all stars, kept so totals can weight by rating count. */
  ratingStars: number;
  ratingCount: number;
  /** ratingStars ÷ ratingCount, unrounded; null when there are no ratings. */
  averageRating: number | null;
}

/** Stats across all of the instructor's courses. Money is in cents. */
export interface AnalyticsTotals {
  grossSales: number;
  earnings: number;
  enrollmentCount: number;
  ratingStars: number;
  ratingCount: number;
  /** Weighted by count (total stars ÷ total ratings); null when none. */
  averageRating: number | null;
}

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
  const ratings = getRatingsByCourse(courseIds, cutoff);

  const courseStats = courseIds.map((courseId): CourseAnalytics => {
    const gross = grossSales.get(courseId) ?? 0;
    return {
      courseId,
      grossSales: gross,
      earnings: earningsFromGross(gross),
      enrollmentCount: enrollmentCounts.get(courseId) ?? 0,
      ...ratingStats(ratings.get(courseId)),
    };
  });

  return { courses: courseStats, totals: buildTotals(courseStats) };
}

function buildTotals(courseStats: CourseAnalytics[]): AnalyticsTotals {
  const sum = (pick: (c: CourseAnalytics) => number) =>
    courseStats.reduce((total, c) => total + pick(c), 0);

  return {
    grossSales: sum((c) => c.grossSales),
    earnings: sum((c) => c.earnings),
    enrollmentCount: sum((c) => c.enrollmentCount),
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
