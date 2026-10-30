import { createHash } from "crypto";

export type OfflineRosterMember = {
  memberNumber: string;
  fullName: string;
  cardNumbers?: string[];
};

type MemberRow = {
  member_number?: string | null;
  full_name?: string | null;
  card_numbers?: unknown;
};

export function toOfflineRosterMember(row: MemberRow): OfflineRosterMember {
  const rawCards = Array.isArray(row.card_numbers) ? row.card_numbers : [];
  const cardNumbers = Array.from(
    new Set(rawCards.map((value) => String(value ?? "").trim()).filter(Boolean))
  );

  return {
    memberNumber: String(row.member_number || "").trim(),
    fullName: String(row.full_name || "").trim(),
    cardNumbers,
  };
}

export function hashOfflineRoster(roster: OfflineRosterMember[]) {
  return createHash("sha256").update(JSON.stringify(roster)).digest("hex");
}
