import {
  GYM_MANAGER_PERMISSIONS,
  GYM_STAFF_PERMISSIONS,
  isSystemPermissionKey,
  normalizeSystemUsername,
  type SystemPermissionKey,
} from "./systemPermissions.ts";

export type SystemUserRole = "gym_staff" | "gym_manager" | "super_admin";

type SystemUserDraft = {
  gymId?: string | null;
  managerGymIds?: unknown;
  username?: string;
  displayName?: string;
  password?: string;
  isSuperAdmin?: boolean;
  role?: unknown;
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

export function resolveSystemUserPermissions(
  roleOrIsSuperAdmin: SystemUserRole | boolean,
  _requestedPermissions?: unknown
): SystemPermissionKey[] {
  const role: SystemUserRole = typeof roleOrIsSuperAdmin === "boolean"
    ? (roleOrIsSuperAdmin ? "super_admin" : "gym_staff")
    : roleOrIsSuperAdmin;
  if (role === "super_admin") return [];
  if (role === "gym_manager") return [...GYM_MANAGER_PERMISSIONS];
  return [...GYM_STAFF_PERMISSIONS];
}

function normalizeManagerGymIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export function validateSystemUserDraft(draft: SystemUserDraft) {
  const requestedRole = String(draft.role || "").trim();
  const role: SystemUserRole = draft.isSuperAdmin || requestedRole === "super_admin"
    ? "super_admin"
    : requestedRole === "gym_manager"
      ? "gym_manager"
      : "gym_staff";
  const gymId = String(draft.gymId || "").trim();
  const managerGymIds = normalizeManagerGymIds(draft.managerGymIds);
  const username = normalizeSystemUsername(String(draft.username || ""));
  const displayName = String(draft.displayName || "").trim();
  const password = String(draft.password || "");

  if (!username || !displayName || password.length < 8) {
    return {
      ok: false as const,
      error: "Username, display name and a password of at least 8 characters are required.",
    };
  }

  if (role === "gym_staff" && !gymId) {
    return {
      ok: false as const,
      error: "A gym must be selected for a gym staff account.",
    };
  }

  if (role === "gym_manager" && managerGymIds.length === 0) {
    return {
      ok: false as const,
      error: "At least one gym must be assigned to a Gym Manager.",
    };
  }

  return {
    ok: true as const,
    role,
    gymId: role === "gym_staff" ? gymId : null,
    managerGymIds: role === "gym_manager" ? managerGymIds : [],
    username,
    displayName,
  };
}
