import { createHash } from "crypto";

export type OfflineRosterMember = {
  memberNumber: string;
  fullName: string;
  accessScope: "network" | "neptunes_only";
  cardNumbers?: string[];
};

type MemberRow = {
  member_number?: string | null;
  full_name?: string | null;
  access_scope?: string | null;
  card_numbers?: unknown;
};

export function toOfflineRosterMember(row: MemberRow): OfflineRosterMember {
  const rawCards = Array.isArray(row.card_numbers) ? row.card_numbers : [];
  const cardNumbers = Array.from(
    new Set(rawCards.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  const accessScope = row.access_scope === "neptunes_only" ? "neptunes_only" : "network";

  return {
    memberNumber: String(row.member_number || "").trim(),
    fullName: String(row.full_name || "").trim(),
    accessScope,
    cardNumbers,
  };
}

export function hashOfflineRoster(roster: OfflineRosterMember[]) {
  return createHash("sha256").update(JSON.stringify(roster)).digest("hex");
}
