/** Cash reconciliation: sufficient/equal counted cash is green; a cash shortfall is red.
 * Missing historical values stay neutral rather than being treated as zero. */
export function barSalesComparisonColor(
  totalSalesCents: number | null,
  cashFoundCents: number | null,
): string {
  if (totalSalesCents == null || cashFoundCents == null) return "text-zinc-950";
  return cashFoundCents >= totalSalesCents ? "text-emerald-700" : "text-red-700";
}
