/** Visual status for a single submitted Bar List; missing historical values stay neutral. */
export function barSalesComparisonColor(
  totalSalesCents: number | null,
  cashFoundCents: number | null,
): string {
  if (totalSalesCents == null || cashFoundCents == null) return "text-zinc-950";
  return totalSalesCents >= cashFoundCents ? "text-emerald-700" : "text-red-700";
}
