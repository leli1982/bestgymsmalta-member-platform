import {
  isSystemPermissionKey,
  normalizeSystemUsername,
  type SystemPermissionKey,
} from "./systemPermissions.ts";

type SystemUserDraft = {
  gymId?: string | null;
  username?: string;
  displayName?: string;
  password?: string;
  isSuperAdmin?: boolean;
};

export function sanitizeSystemPermissions(values: unknown): SystemPermissionKey[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<SystemPermissionKey>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    if (!isSystemPermissionKey(value)) continue;
    seen.add(value);
  }

  return Array.from(seen);
}

export function validateSystemUserDraft(draft: SystemUserDraft) {
  const isSuperAdmin = Boolean(draft.isSuperAdmin);
  const gymId = String(draft.gymId || "").trim();
  const username = normalizeSystemUsername(String(draft.username || ""));
  const displayName = String(draft.displayName || "").trim();
  const password = String(draft.password || "");

  if (!username || !displayName || password.length < 8) {
    return {
      ok: false as const,
      error: "Username, display name and a password of at least 8 characters are required.",
    };
  }

  if (!isSuperAdmin && !gymId) {
    return {
      ok: false as const,
      error: "A gym must be selected for a gym system account.",
    };
  }

  return {
    ok: true as const,
    gymId: isSuperAdmin ? null : gymId,
    username,
    displayName,
  };
}
