import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatMoney } from "~/lib/utils";
import type { AnalyticsTotals } from "~/services/analyticsService";

/** One metric tile in the summary grid. Add a tile per new total. */
export function SummaryTile({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Whole-percent completion rate, or an em dash when there are no enrollments. */
export function formatCompletionRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** Totals across the instructor's courses, shown at the top of the page. */
export function AnalyticsSummary({ totals }: { totals: AnalyticsTotals }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryTile
        label="Earnings"
        value={formatMoney(totals.earnings)}
        subtitle={`${formatMoney(totals.grossSales)} gross sales`}
      />
      <SummaryTile label="Enrollments" value={totals.enrollmentCount} />
      <SummaryTile
        label="Completion rate"
        value={formatCompletionRate(totals.completionRate)}
        subtitle={`${totals.completedCount} of ${totals.enrollmentCount} completed`}
      />
      <SummaryTile label="Never started" value={totals.neverStartedCount} />
      <SummaryTile
        label="Dropped off"
        value={totals.droppedOffCount}
        subtitle="No activity in the last 30 days"
      />
    </div>
  );
}
