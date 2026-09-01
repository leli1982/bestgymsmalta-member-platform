import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createSystemSessionToken,
  getClearedSystemSessionCookieOptions,
  getSystemSessionCookieOptions,
  hasSystemPermission,
  resolveSystemSessionSecret,
  verifySystemSessionToken,
  type SystemSessionIdentity,
} from "@/lib/systemAuthCore";

const SYSTEM_COOKIE_NAME = "bgm_system_session";
const SYSTEM_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type SystemContext = SystemSessionIdentity & {
  permissions: string[];
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
    .select("id, gym_id, username, display_name, is_super_admin, active")
    .eq("id", session.systemUserId)
    .maybeSingle();

  if (accountResult.error) throw accountResult.error;
  const account = accountResult.data;
  if (!account || !account.active) return null;

  let permissions: string[] = [];

  if (!account.is_super_admin) {
    const permissionResult = await supabase
      .from("bgm_user_permissions")
      .select("permission_key")
      .eq("system_user_id", account.id)
      .eq("allowed", true);

    if (permissionResult.error) throw permissionResult.error;
    permissions = (permissionResult.data || []).map(
      (row) => row.permission_key as string
    );
  }

  return {
    systemUserId: account.id,
    gymId: account.gym_id || null,
    username: account.username,
    displayName: account.display_name,
    isSuperAdmin: Boolean(account.is_super_admin),
    permissions,
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
