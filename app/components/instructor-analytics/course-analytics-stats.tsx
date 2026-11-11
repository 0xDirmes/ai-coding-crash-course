import type { ReactNode } from "react";
import { formatMoney } from "~/lib/utils";
import type { CourseAnalytics } from "~/services/analyticsService";

/** Whole-percent completion rate, or an em dash when there are no enrollments. */
export function formatCompletionRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** "4.6 ★ (128)", or "No ratings yet" when there are none. */
export function formatRating(averageRating: number | null, ratingCount: number) {
  if (averageRating === null || ratingCount === 0) return "No ratings yet";
  return `${averageRating.toFixed(1)} ★ (${ratingCount})`;
}

/** One label/value row in a course card's stats. Add a row per new metric. */
export function CourseStatRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** Per-course analytics shown on an instructor course card. */
export function CourseAnalyticsStats({ stats }: { stats: CourseAnalytics }) {
  return (
    <dl className="mt-4 space-y-1.5 border-t pt-4 text-sm">
      <CourseStatRow label="Earnings" value={formatMoney(stats.earnings)} />
      <CourseStatRow label="Gross sales" value={formatMoney(stats.grossSales)} />
      <CourseStatRow label="Enrollments" value={stats.enrollmentCount} />
      <CourseStatRow
        label="Completion rate"
        value={formatCompletionRate(stats.completionRate)}
      />
      <CourseStatRow label="Never started" value={stats.neverStartedCount} />
      <CourseStatRow label="Dropped off" value={stats.droppedOffCount} />
      <CourseStatRow
        label="Average rating"
        value={formatRating(stats.averageRating, stats.ratingCount)}
      />
    </dl>
  );
}
