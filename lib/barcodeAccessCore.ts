export type BarcodeAccessResult =
  | "granted"
  | "expired"
  | "inactive"
  | "restricted_gym"
  | "unknown_member";

type BarcodeMemberState = {
  status?: string | null;
  membershipExpiry?: string | null;
  cancellationEffectiveDate?: string | null;
  accessScope?: string | null;
};

const NEPTUNES_GYM_ID = "bgm-neptunes";

export function evaluateBarcodeAccess({
  member,
  today,
  gymId,
}: {
  member: BarcodeMemberState | null;
  today: string;
  gymId?: string | null;
}): { result: BarcodeAccessResult; granted: boolean } {
  if (!member) {
    return { result: "unknown_member", granted: false };
  }

  if (member.cancellationEffectiveDate && member.cancellationEffectiveDate <= today) {
    return { result: "inactive", granted: false };
  }

  if (member.status !== "active") {
    return { result: "inactive", granted: false };
  }

  if (member.membershipExpiry && member.membershipExpiry < today) {
    return { result: "expired", granted: false };
  }

  if (
    member.accessScope === "neptunes_only" &&
    gymId &&
    gymId !== NEPTUNES_GYM_ID
  ) {
    return { result: "restricted_gym", granted: false };
  }

  return { result: "granted", granted: true };
}
