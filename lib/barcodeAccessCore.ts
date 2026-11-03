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
  pendingAccessScope?: string | null;
  pendingAccessGymId?: string | null;
  pendingAccessEffectiveDate?: string | null;
};

function effectiveAccess(member: BarcodeMemberState, today: string) {
  const pendingIsEffective = Boolean(
    member.pendingAccessScope &&
      member.pendingAccessEffectiveDate &&
      member.pendingAccessEffectiveDate <= today,
  );
  const accessScope = pendingIsEffective ? member.pendingAccessScope : member.accessScope;
  const explicitGymId = pendingIsEffective ? member.pendingAccessGymId : member.accessGymId;
  const accessGymId = explicitGymId || (accessScope === "neptunes_only" ? "bgm-neptunes" : null);
  return { accessScope, accessGymId };
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

  const effective = effectiveAccess(member, today);
  if (
    (effective.accessScope === "single_gym" || effective.accessScope === "neptunes_only") &&
    effective.accessGymId &&
    gymId &&
    gymId !== effective.accessGymId
  ) {
    return { result: "restricted_gym", granted: false };
  }

  return { result: "granted", granted: true };
}
