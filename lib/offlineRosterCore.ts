import { createHash } from "crypto";

export type OfflineRosterMember = {
  memberNumber: string;
  fullName: string;
  accessScope: "network" | "single_gym" | "neptunes_only";
  accessGymId: string | null;
  cardNumbers?: string[];
};

type MemberRow = {
  member_number?: string | null;
  full_name?: string | null;
  access_scope?: string | null;
  access_gym_id?: string | null;
  pending_access_scope?: string | null;
  pending_access_gym_id?: string | null;
  pending_access_effective_date?: string | null;
  card_numbers?: unknown;
};

export function toOfflineRosterMember(
  row: MemberRow,
  today = new Date().toISOString().slice(0, 10),
): OfflineRosterMember {
  const rawCards = Array.isArray(row.card_numbers) ? row.card_numbers : [];
  const cardNumbers = Array.from(
    new Set(rawCards.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  const pendingIsEffective = Boolean(
    row.pending_access_scope &&
      row.pending_access_effective_date &&
      row.pending_access_effective_date <= today,
  );
  const rawScope = pendingIsEffective ? row.pending_access_scope : row.access_scope;
  const rawGymId = pendingIsEffective ? row.pending_access_gym_id : row.access_gym_id;
  const accessScope = rawScope === "single_gym"
    ? "single_gym"
    : rawScope === "neptunes_only"
      ? "neptunes_only"
      : "network";
  const explicitGymId = String(rawGymId || "").trim() || null;
  const accessGymId = accessScope === "network"
    ? null
    : explicitGymId || (accessScope === "neptunes_only" ? "bgm-neptunes" : null);

  return {
    memberNumber: String(row.member_number || "").trim(),
    fullName: String(row.full_name || "").trim(),
    accessScope,
    accessGymId,
    cardNumbers,
  };
}

export function hashOfflineRoster(roster: OfflineRosterMember[]) {
  return createHash("sha256").update(JSON.stringify(roster)).digest("hex");
}
