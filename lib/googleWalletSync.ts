import "server-only";

import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  googleWalletObjectId,
  type GoogleWalletMemberSnapshot,
} from "./googleWalletCore";
import {
  getGoogleWalletConfig,
  safeGoogleWalletError,
  upsertGoogleWalletObject,
} from "./googleWalletServer";

export type GoogleWalletSyncResult =
  | "not_provisioned"
  | "unavailable"
  | "synced"
  | "failed";

export type GoogleWalletPassStatus = {
  provisioned: boolean;
  syncStatus: "pending" | "synced" | "failed" | null;
  lastSyncedAt: string | null;
};

type MemberRow = {
  id: string;
  member_number: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  membership_expiry: string | null;
  cancellation_effective_date: string | null;
  archived_at: string | null;
};

type CardRow = {
  barcode_value: string | null;
  status: string | null;
  updated_at: string | null;
  assigned_at: string | null;
};

type WalletPassRow = {
  member_id: string;
  object_id: string;
  class_id: string;
  sync_status: "pending" | "synced" | "failed";
  last_synced_at: string | null;
};

function fullName(member: MemberRow): string {
  const explicit = String(member.full_name || "").trim();
  if (explicit) return explicit;
  return [member.first_name, member.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

export async function loadGoogleWalletMemberSnapshot(
  memberId: string,
): Promise<GoogleWalletMemberSnapshot | null> {
  const admin = getSupabaseAdmin();
  const { data: member, error: memberError } = await admin
    .from("bgm_members")
    .select(
      "id,member_number,full_name,first_name,last_name,status,membership_expiry,cancellation_effective_date,archived_at",
    )
    .eq("id", memberId)
    .maybeSingle<MemberRow>();

  if (memberError || !member) return null;

  const { data: card, error: cardError } = await admin
    .from("bgm_member_card_credentials")
    .select("barcode_value,status,updated_at,assigned_at")
    .eq("member_id", memberId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<CardRow>();

  if (cardError) return null;

  return {
    memberId: member.id,
    fullName: fullName(member),
    memberNumber: String(member.member_number || "").trim(),
    status: String(member.status || "").trim(),
    membershipExpiry: member.membership_expiry,
    cancellationEffectiveDate: member.cancellation_effective_date,
    archivedAt: member.archived_at,
    activeCardBarcode: card?.barcode_value
      ? String(card.barcode_value).trim()
      : null,
  };
}

export async function getGoogleWalletPassStatus(
  memberId: string,
): Promise<GoogleWalletPassStatus> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("bgm_google_wallet_passes")
    .select("member_id,object_id,class_id,sync_status,last_synced_at")
    .eq("member_id", memberId)
    .maybeSingle<WalletPassRow>();

  if (error || !data) {
    return {
      provisioned: false,
      syncStatus: null,
      lastSyncedAt: null,
    };
  }

  return {
    provisioned: true,
    syncStatus: data.sync_status,
    lastSyncedAt: data.last_synced_at,
  };
}

export async function syncGoogleWalletPassForMember(
  memberId: string,
  options: { provision: boolean },
): Promise<GoogleWalletSyncResult> {
  let config;
  try {
    config = getGoogleWalletConfig();
  } catch {
    return "unavailable";
  }
  if (!config) return "unavailable";

  const admin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await admin
    .from("bgm_google_wallet_passes")
    .select("member_id,object_id,class_id,sync_status,last_synced_at")
    .eq("member_id", memberId)
    .maybeSingle<WalletPassRow>();

  if (existingError) return "failed";
  if (!existing && !options.provision) {
    return "not_provisioned";
  }

  const snapshot = await loadGoogleWalletMemberSnapshot(memberId);
  if (!snapshot) return "failed";

  const objectId = googleWalletObjectId(
    config.issuerId,
    memberId,
    config.objectPrefix,
  );
  const attemptedAt = new Date().toISOString();

  const { error: pendingError } = await admin
    .from("bgm_google_wallet_passes")
    .upsert(
      {
        member_id: memberId,
        object_id: objectId,
        class_id: config.classId,
        sync_status: "pending",
        last_attempt_at: attemptedAt,
        last_error: null,
      },
      { onConflict: "member_id" },
    );

  if (pendingError) return "failed";

  try {
    await upsertGoogleWalletObject(snapshot, config);
    const { error: syncedError } = await admin
      .from("bgm_google_wallet_passes")
      .update({
        object_id: objectId,
        class_id: config.classId,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        last_attempt_at: attemptedAt,
        last_error: null,
      })
      .eq("member_id", memberId);

    return syncedError ? "failed" : "synced";
  } catch (error) {
    const safeError = safeGoogleWalletError(error);
    await admin
      .from("bgm_google_wallet_passes")
      .update({
        object_id: objectId,
        class_id: config.classId,
        sync_status: "failed",
        last_attempt_at: attemptedAt,
        last_error: safeError,
      })
      .eq("member_id", memberId);
    return "failed";
  }
}

export async function bestEffortSyncGoogleWalletMembers(
  memberIds: string[],
): Promise<void> {
  const uniqueMemberIds = Array.from(new Set(memberIds.filter(Boolean)));
  for (const memberId of uniqueMemberIds) {
    try {
      await syncGoogleWalletPassForMember(memberId, { provision: false });
    } catch {
      // Wallet recovery must never break the BGM mutation that triggered it.
    }
  }
}
