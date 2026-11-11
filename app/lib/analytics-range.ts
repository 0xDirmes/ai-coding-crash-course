// Analytics time ranges. Client-safe (no db import) so the range selector can
// share it with analyticsService.

export const ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

/** Days covered by each bounded range; "all" has no cutoff. */
export const ANALYTICS_RANGE_DAYS: Record<Exclude<AnalyticsRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Parses a `?range=` value. Missing or unknown values fall back to "all". */
export function parseAnalyticsRange(value: string | null | undefined): AnalyticsRange {
  return ANALYTICS_RANGES.find((range) => range === value) ?? "all";
}
