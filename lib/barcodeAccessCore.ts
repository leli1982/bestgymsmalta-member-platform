export type BarcodeAccessResult =
  | "granted"
  | "expired"
  | "inactive"
  | "unknown_member";

type BarcodeMemberState = {
  status?: string | null;
  membershipExpiry?: string | null;
};

export function evaluateBarcodeAccess({
  member,
  today,
}: {
  member: BarcodeMemberState | null;
  today: string;
}): { result: BarcodeAccessResult; granted: boolean } {
  if (!member) {
    return { result: "unknown_member", granted: false };
  }

  if (member.status !== "active") {
    return { result: "inactive", granted: false };
  }

  if (member.membershipExpiry && member.membershipExpiry < today) {
    return { result: "expired", granted: false };
  }

  return { result: "granted", granted: true };
}
