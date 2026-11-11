import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
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

/** Stats across all of the instructor's courses. Money is in cents. */
export interface AnalyticsTotals {
  grossSales: number;
  earnings: number;
  enrollmentCount: number;
  completedCount: number;
  /** Recomputed from summed counts, not averaged per course. */
  completionRate: number | null;
  neverStartedCount: number;
  droppedOffCount: number;
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
    const studentActivity = activity.get(activityKey(e.userId, e.courseId));
    if (!studentActivity) {
      stats.neverStarted += 1;
    } else if (
      e.completedAt === null &&
      studentActivity.latest !== null &&
      studentActivity.latest < inactiveBefore
    ) {
      stats.droppedOff += 1;
    }
    byCourse.set(e.courseId, stats);
  }
  return byCourse;
}

/** A student's activity on a course; latest is null when nothing is dated. */
interface StudentActivity {
  latest: string | null;
}

function activityKey(userId: number, courseId: number) {
  return `${userId}:${courseId}`;
}

/**
 * Activity per (student, course) from lesson progress, video watch events and
 * quiz attempts on the course's lessons. Any lesson progress row (even an
 * undated in-progress one) means the student has started; only dated events
 * set `latest`.
 */
function getActivityByStudentCourse(courseIds: number[]) {
  const progress = db
    .select({
      userId: lessonProgress.userId,
      courseId: modules.courseId,
      latest: sql<string | null>`max(${lessonProgress.completedAt})`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(lessonProgress.userId, modules.courseId)
    .all();

  const videos = db
    .select({
      userId: videoWatchEvents.userId,
      courseId: modules.courseId,
      latest: sql<string | null>`max(${videoWatchEvents.createdAt})`,
    })
    .from(videoWatchEvents)
    .innerJoin(lessons, eq(videoWatchEvents.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(videoWatchEvents.userId, modules.courseId)
    .all();

  const quizAttemptRows = db
    .select({
      userId: quizAttempts.userId,
      courseId: modules.courseId,
      latest: sql<string | null>`max(${quizAttempts.attemptedAt})`,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(quizAttempts.userId, modules.courseId)
    .all();

  const byStudentCourse = new Map<string, StudentActivity>();
  for (const row of [...progress, ...videos, ...quizAttemptRows]) {
    const key = activityKey(row.userId, row.courseId);
    const current = byStudentCourse.get(key);
    byStudentCourse.set(key, {
      latest: laterOf(current?.latest ?? null, row.latest),
    });
  }
  return byStudentCourse;
}

function laterOf(a: string | null, b: string | null) {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}
