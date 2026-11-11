import type { ReactNode } from "react";
import { formatMoney } from "~/lib/utils";
import type { CourseAnalytics } from "~/services/analyticsService";

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
        label="Average rating"
        value={formatRating(stats.averageRating, stats.ratingCount)}
      />
    </dl>
  );
}
