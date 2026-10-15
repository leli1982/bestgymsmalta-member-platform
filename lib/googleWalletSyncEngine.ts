import "server-only";

import { getSupabaseAdmin } from "./supabaseAdmin";
import { syncGoogleWalletPassForMember } from "./googleWalletSync";

type PendingWalletRow = {
  member_id: string;
  sync_status: "pending" | "failed";
  updated_at: string;
};

export type GoogleWalletRecoverySummary = {
  examined: number;
  synced: number;
  failed: number;
  skipped: number;
};

export async function runGoogleWalletRecoverySync(
  { pageSize = 25 }: { pageSize?: number } = {},
): Promise<GoogleWalletRecoverySummary> {
  const normalizedPageSize = Number.isFinite(pageSize) ? Math.trunc(pageSize) : 25;
  const limit = Math.min(50, Math.max(1, normalizedPageSize));
  const summary: GoogleWalletRecoverySummary = {
    examined: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
  };

  const result = await getSupabaseAdmin()
    .from("bgm_google_wallet_passes")
    .select("member_id,sync_status,updated_at")
    .in("sync_status", ["pending", "failed"])
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (result.error) throw result.error;

  for (const row of (result.data || []) as PendingWalletRow[]) {
    summary.examined += 1;
    try {
      const outcome = await syncGoogleWalletPassForMember(row.member_id, { provision: false });
      if (outcome === "synced") {
        summary.synced += 1;
      } else if (outcome === "failed") {
        summary.failed += 1;
      } else {
        // `unavailable` keeps the mapping retryable and `not_provisioned` can
        // only happen if the mapping disappears after this bounded selection.
        summary.skipped += 1;
      }
    } catch {
      // Isolate one member so the remaining recovery candidates still run.
      summary.failed += 1;
    }
  }

  return summary;
}
