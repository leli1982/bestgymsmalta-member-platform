import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { GYM_MANAGER_PERMISSIONS, GYM_STAFF_PERMISSIONS } from "@/lib/systemPermissions";
import {
  createSystemSessionToken,
  getClearedSystemSessionCookieOptions,
  getSystemSessionCookieOptions,
  hasSystemPermission,
  resolveSystemSessionSecret,
  verifySystemSessionToken,
  type SystemSessionIdentity,
} from "@/lib/systemAuthCore";
import type { SystemUserRole } from "@/lib/systemUserCore";

const SYSTEM_COOKIE_NAME = "bgm_system_session";
const SYSTEM_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type SystemContext = SystemSessionIdentity & {
  role: SystemUserRole;
  permissions: string[];
  managedGymIds: string[];
};

function getSystemSecret() {
  const secret = resolveSystemSessionSecret({
    BGM_SYSTEM_SESSION_SECRET: process.env.BGM_SYSTEM_SESSION_SECRET,
    BGM_ADMIN_SESSION_SECRET: process.env.BGM_ADMIN_SESSION_SECRET,
    BGM_ADMIN_PIN: process.env.BGM_ADMIN_PIN,
  });

  if (!secret) {
    throw new Error("Missing BGM system session secret.");
  }

  return secret;
}

export function setSystemSessionCookie(
  response: NextResponse,
  identity: SystemSessionIdentity
) {
  const token = createSystemSessionToken(identity, getSystemSecret(), {
    ttlMs: SYSTEM_SESSION_TTL_MS,
  });

  response.cookies.set(
    SYSTEM_COOKIE_NAME,
    token,
    getSystemSessionCookieOptions(process.env.NODE_ENV === "production")
  );

  return response;
}

export function clearSystemSessionCookie(response: NextResponse) {
  response.cookies.set(
    SYSTEM_COOKIE_NAME,
    "",
    getClearedSystemSessionCookieOptions(process.env.NODE_ENV === "production")
  );
  return response;
}

export async function getSystemContext(
  request: NextRequest
): Promise<SystemContext | null> {
  const token = request.cookies.get(SYSTEM_COOKIE_NAME)?.value;
  const session = verifySystemSessionToken(token, getSystemSecret());

  if (!session) return null;

  const supabase = getSupabaseAdmin();
  const accountResult = await supabase
    .from("bgm_system_users")
    .select("id, gym_id, username, display_name, is_super_admin, active, role")
    .eq("id", session.systemUserId)
    .maybeSingle();

  if (accountResult.error) throw accountResult.error;
  const account = accountResult.data;
  if (!account || !account.active) return null;

  const role: SystemUserRole = account.is_super_admin || account.role === "super_admin"
    ? "super_admin"
    : account.role === "gym_manager"
      ? "gym_manager"
      : "gym_staff";

  let managedGymIds: string[] = [];
  if (role === "gym_manager") {
    const assignmentResult = await supabase
      .from("bgm_manager_gym_assignments")
      .select("gym_id")
      .eq("manager_user_id", account.id)
      .order("gym_id", { ascending: true });
    if (assignmentResult.error) throw assignmentResult.error;
    managedGymIds = (assignmentResult.data || []).map((row) => String(row.gym_id));
  }

  // Operational Staff and Gym Manager are fixed roles. Do not trust historical
  // per-user permission rows. Super Admin continues to bypass permission checks.
  const permissions = role === "super_admin"
    ? []
    : role === "gym_manager"
      ? [...GYM_MANAGER_PERMISSIONS]
      : [...GYM_STAFF_PERMISSIONS];

  return {
    systemUserId: account.id,
    gymId: role === "gym_staff" ? account.gym_id || null : null,
    username: account.username,
    displayName: account.display_name,
    isSuperAdmin: role === "super_admin",
    role,
    permissions,
    managedGymIds,
  };
}

export async function requireSystemPermission(
  request: NextRequest,
  permissionKey: string
) {
  const context = await getSystemContext(request);

  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "System login required." }, { status: 401 }),
    };
  }

  if (!hasSystemPermission(context, permissionKey)) {
    return {
      context: null,
      error: NextResponse.json(
        { error: "This account does not have permission for that action." },
        { status: 403 }
      ),
    };
  }

  return { context, error: null };
}

export async function requireGymManager(request: NextRequest) {
  const context = await getSystemContext(request);
  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "System login required." }, { status: 401 }),
    };
  }
  if (context.role !== "gym_manager") {
    return {
      context: null,
      error: NextResponse.json({ error: "Gym Manager access required." }, { status: 403 }),
    };
  }
  return { context, error: null };
}

export async function requireSuperAdmin(request: NextRequest) {
  const context = await getSystemContext(request);

  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "System login required." }, { status: 401 }),
    };
  }

  if (!context.isSuperAdmin) {
    return {
      context: null,
      error: NextResponse.json(
        { error: "Super Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { context, error: null };
}
