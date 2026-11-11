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
    </div>
  );
}
