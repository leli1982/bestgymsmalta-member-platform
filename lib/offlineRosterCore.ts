import { createHash } from "crypto";

export type OfflineRosterMember = {
  memberNumber: string;
  fullName: string;
  accessScope: "network" | "single_gym" | "neptunes_only";
  accessGymId: string | null;
  accessGymName: string | null;
  pendingAccessScope: "network" | "single_gym" | "neptunes_only" | null;
  pendingAccessGymId: string | null;
  pendingAccessGymName: string | null;
  pendingAccessEffectiveDate: string | null;
  membershipExpiry: string | null;
  cancellationEffectiveDate: string | null;
  cardNumbers?: string[];
};

type MemberRow = {
  member_number?: string | null;
  full_name?: string | null;
  access_scope?: string | null;
  access_gym_id?: string | null;
  access_gym_name?: string | null;
  pending_access_scope?: string | null;
  pending_access_gym_id?: string | null;
  pending_access_gym_name?: string | null;
  pending_access_effective_date?: string | null;
  membership_expiry?: string | null;
  cancellation_effective_date?: string | null;
  card_numbers?: unknown;
};

function rosterScope(value: unknown): OfflineRosterMember["accessScope"] {
  return value === "single_gym"
    ? "single_gym"
    : value === "neptunes_only"
      ? "neptunes_only"
      : "network";
}

function optionalText(value: unknown) {
  return String(value || "").trim() || null;
}

export function toOfflineRosterMember(row: MemberRow): OfflineRosterMember {
  const rawCards = Array.isArray(row.card_numbers) ? row.card_numbers : [];
  const cardNumbers = Array.from(
    new Set(rawCards.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  const accessScope = rosterScope(row.access_scope);
  const pendingAccessScope = row.pending_access_scope
    ? rosterScope(row.pending_access_scope)
    : null;
  const accessGymId = accessScope === "network"
    ? null
    : optionalText(row.access_gym_id) || (accessScope === "neptunes_only" ? "bgm-neptunes" : null);
  const pendingAccessGymId = pendingAccessScope === "network" || !pendingAccessScope
    ? null
    : optionalText(row.pending_access_gym_id) || (pendingAccessScope === "neptunes_only" ? "bgm-neptunes" : null);

  return {
    memberNumber: String(row.member_number || "").trim(),
    fullName: String(row.full_name || "").trim(),
    accessScope,
    accessGymId,
    accessGymName: accessScope === "network" ? null : optionalText(row.access_gym_name),
    pendingAccessScope,
    pendingAccessGymId,
    pendingAccessGymName: pendingAccessScope === "network" || !pendingAccessScope
      ? null
      : optionalText(row.pending_access_gym_name),
    pendingAccessEffectiveDate: optionalText(row.pending_access_effective_date),
    membershipExpiry: optionalText(row.membership_expiry),
    cancellationEffectiveDate: optionalText(row.cancellation_effective_date),
    cardNumbers,
  };
}

export function hashOfflineRoster(roster: OfflineRosterMember[]) {
  return createHash("sha256").update(JSON.stringify(roster)).digest("hex");
}
