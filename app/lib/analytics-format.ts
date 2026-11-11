// Display formatting for instructor analytics, shared by the summary tiles and
// the per-course card stats.

/** Whole-percent completion rate, or an em dash when there are no enrollments. */
export function formatCompletionRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** "4.6 ★ (128)", or "No ratings yet" when there are none. */
export function formatRating(averageRating: number | null, ratingCount: number) {
  if (averageRating === null || ratingCount === 0) return "No ratings yet";
  return `${averageRating.toFixed(1)} ★ (${ratingCount})`;
}
