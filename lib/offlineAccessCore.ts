export type OfflineAccessScope = "network" | "single_gym" | "neptunes_only";

export type OfflineAccessMember = {
  accessScope: OfflineAccessScope;
  accessGymId: string | null;
  accessGymName?: string | null;
  pendingAccessScope?: OfflineAccessScope | null;
  pendingAccessGymId?: string | null;
  pendingAccessGymName?: string | null;
  pendingAccessEffectiveDate?: string | null;
  membershipExpiry?: string | null;
  cancellationEffectiveDate?: string | null;
};

export type EffectiveOfflineAccess = {
  accessScope: "network" | "single_gym";
  accessGymId: string | null;
  accessGymName: string | null;
};

function normalizeScope(value: unknown): "network" | "single_gym" {
  return value === "single_gym" || value === "neptunes_only" ? "single_gym" : "network";
}

function normalizedGymId(scope: unknown, gymId: unknown) {
  if (normalizeScope(scope) !== "single_gym") return null;
  const explicit = String(gymId || "").trim();
  if (explicit) return explicit;
  return scope === "neptunes_only" ? "bgm-neptunes" : null;
}

function stateAllowsGym(scope: "network" | "single_gym", gymId: string, assignedGymId: string | null) {
  return scope === "network" || Boolean(gymId && assignedGymId && gymId === assignedGymId);
}

export function effectiveOfflineAccess(member: OfflineAccessMember, today: string): EffectiveOfflineAccess {
  const pendingIsEffective = Boolean(
    member.pendingAccessScope &&
      member.pendingAccessEffectiveDate &&
      member.pendingAccessEffectiveDate <= today,
  );
  const rawScope = pendingIsEffective ? member.pendingAccessScope : member.accessScope;
  const rawGymId = pendingIsEffective ? member.pendingAccessGymId : member.accessGymId;
  const rawGymName = pendingIsEffective ? member.pendingAccessGymName : member.accessGymName;
  const accessScope = normalizeScope(rawScope);
  return {
    accessScope,
    accessGymId: normalizedGymId(rawScope, rawGymId),
    accessGymName: accessScope === "single_gym" ? String(rawGymName || "").trim() || null : null,
  };
}

export function offlineRosterMemberMayMatterAtGym(member: OfflineAccessMember, gymId: string) {
  const currentScope = normalizeScope(member.accessScope);
  const currentGymId = normalizedGymId(member.accessScope, member.accessGymId);
  if (stateAllowsGym(currentScope, gymId, currentGymId)) return true;
  if (!member.pendingAccessScope || !member.pendingAccessEffectiveDate) return false;
  const pendingScope = normalizeScope(member.pendingAccessScope);
  const pendingGymId = normalizedGymId(member.pendingAccessScope, member.pendingAccessGymId);
  return stateAllowsGym(pendingScope, gymId, pendingGymId);
}

export function evaluateOfflineRosterMember(member: OfflineAccessMember, gymId: string, today: string) {
  const effective = effectiveOfflineAccess(member, today);
  if (member.cancellationEffectiveDate && member.cancellationEffectiveDate <= today) {
    return { ...effective, granted: false, result: "inactive" as const };
  }
  if (member.membershipExpiry && member.membershipExpiry < today) {
    return { ...effective, granted: false, result: "expired" as const };
  }
  const granted = stateAllowsGym(effective.accessScope, gymId, effective.accessGymId);
  return {
    ...effective,
    granted,
    result: granted ? ("granted" as const) : ("restricted_gym" as const),
  };
}
