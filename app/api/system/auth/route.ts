import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clearSystemSessionCookie,
  getSystemContext,
  setSystemSessionCookie,
} from "@/lib/systemAuth";
import { classifySystemLoginError } from "@/lib/systemLoginError";
import { normalizeSystemUsername } from "@/lib/systemPermissions";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function publicContext(context: Awaited<ReturnType<typeof getSystemContext>>) {
  if (!context) return null;

  return {
    id: context.systemUserId,
    gymId: context.gymId,
    username: context.username,
    displayName: context.displayName,
    isSuperAdmin: context.isSuperAdmin,
    permissions: context.permissions,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getSystemContext(request);

    return NextResponse.json({
      authenticated: Boolean(context),
      user: publicContext(context),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { authenticated: false, user: null, error: "Could not verify system session." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gymSlug = clean(body.gymSlug).toLowerCase();
    const username = normalizeSystemUsername(String(body.username || ""));
    const password = String(body.password || "");

    if (!password || (!gymSlug && !username)) {
      return NextResponse.json(
        { error: gymSlug ? "Staff password is required." : "Username and password are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let accountResult;

    if (gymSlug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymSlug)) {
        return NextResponse.json({ error: "Gym staff login not found." }, { status: 404 });
      }

      const gymResult = await supabase
        .from("bgm_gyms")
        .select("id, name, public_enrollment_slug")
        .eq("public_enrollment_slug", gymSlug)
        .maybeSingle();

      if (gymResult.error) throw gymResult.error;
      if (!gymResult.data) {
        return NextResponse.json({ error: "Gym staff login not found." }, { status: 404 });
      }

      accountResult = await supabase
        .from("bgm_system_users")
        .select("id, gym_id, username, password_hash, display_name, is_super_admin, active")
        .eq("gym_id", gymResult.data.id)
        .eq("is_super_admin", false)
        .maybeSingle();
    } else {
      accountResult = await supabase
        .from("bgm_system_users")
        .select("id, gym_id, username, password_hash, display_name, is_super_admin, active")
        .eq("username", username)
        .maybeSingle();
    }

    if (accountResult.error) throw accountResult.error;
    const account = accountResult.data;

    if (!account || !account.password_hash) {
      return NextResponse.json(
        { error: gymSlug ? "Incorrect staff password." : "Incorrect username or password." },
        { status: 401 }
      );
    }

    if (!account.active) {
      return NextResponse.json(
        { error: "This system account is disabled." },
        { status: 403 }
      );
    }

    const passwordOk = await bcrypt.compare(password, account.password_hash);

    if (!passwordOk) {
      return NextResponse.json(
        { error: gymSlug ? "Incorrect staff password." : "Incorrect username or password." },
        { status: 401 }
      );
    }

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

    const now = new Date().toISOString();
    const updateResult = await supabase
      .from("bgm_system_users")
      .update({ last_login_at: now, updated_at: now })
      .eq("id", account.id);

    if (updateResult.error) throw updateResult.error;

    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: account.id,
        gymId: account.gym_id || null,
        username: account.username,
        displayName: account.display_name,
        isSuperAdmin: Boolean(account.is_super_admin),
        permissions,
      },
    });

    return setSystemSessionCookie(response, {
      systemUserId: account.id,
      gymId: account.gym_id || null,
      username: account.username,
      displayName: account.display_name,
      isSuperAdmin: Boolean(account.is_super_admin),
    });
  } catch (error) {
    console.error(error);
    const classified = classifySystemLoginError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  return clearSystemSessionCookie(response);
}
