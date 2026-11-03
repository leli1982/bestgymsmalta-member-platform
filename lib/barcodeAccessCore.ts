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
  accessGymId?: string | null;
};

function targetGymId(member: BarcodeMemberState) {
  if (member.accessGymId) return member.accessGymId;
  return member.accessScope === "neptunes_only" ? "bgm-neptunes" : null;
}

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

  const restrictedGymId = targetGymId(member);
  if (
    (member.accessScope === "single_gym" || member.accessScope === "neptunes_only") &&
    restrictedGymId &&
    gymId &&
    gymId !== restrictedGymId
  ) {
    return { result: "restricted_gym", granted: false };
  }

  return { result: "granted", granted: true };
}
