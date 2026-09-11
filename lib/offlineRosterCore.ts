import { createHash } from "crypto";

export type OfflineRosterMember = {
  memberNumber: string;
  fullName: string;
};

type MemberRow = {
  member_number?: string | null;
  full_name?: string | null;
};

export function toOfflineRosterMember(row: MemberRow): OfflineRosterMember {
  return {
    memberNumber: String(row.member_number || "").trim(),
    fullName: String(row.full_name || "").trim(),
  };
}

export function hashOfflineRoster(roster: OfflineRosterMember[]) {
  return createHash("sha256").update(JSON.stringify(roster)).digest("hex");
}
