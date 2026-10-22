import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clearSystemSessionCookie,
  getSystemContext,
  setSystemSessionCookie,
} from "@/lib/systemAuth";
import { classifySystemLoginError } from "@/lib/systemLoginError";
import {
  GYM_MANAGER_PERMISSIONS,
  GYM_STAFF_PERMISSIONS,
  normalizeSystemUsername,
} from "@/lib/systemPermissions";
import type { SystemUserRole } from "@/lib/systemUserCore";

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
    role: context.role,
    managedGymIds: context.managedGymIds,
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
        .eq("status", "active")
        .maybeSingle();

      if (gymResult.error) throw gymResult.error;
      if (!gymResult.data) {
        return NextResponse.json({ error: "Gym staff login not found." }, { status: 404 });
      }

      accountResult = await supabase
        .from("bgm_system_users")
        .select("id, gym_id, username, password_hash, display_name, is_super_admin, active, role")
        .eq("gym_id", gymResult.data.id)
        .eq("role", "gym_staff")
        .maybeSingle();
    } else {
      accountResult = await supabase
        .from("bgm_system_users")
        .select("id, gym_id, username, password_hash, display_name, is_super_admin, active, role")
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
      if (managedGymIds.length === 0) {
        return NextResponse.json({ error: "This Gym Manager has no assigned gyms." }, { status: 403 });
      }
    }

    const permissions = role === "super_admin"
      ? []
      : role === "gym_manager"
        ? [...GYM_MANAGER_PERMISSIONS]
        : [...GYM_STAFF_PERMISSIONS];

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
        gymId: role === "gym_staff" ? account.gym_id || null : null,
        username: account.username,
        displayName: account.display_name,
        isSuperAdmin: role === "super_admin",
        role,
        managedGymIds,
        permissions,
      },
    });

    return setSystemSessionCookie(response, {
      systemUserId: account.id,
      gymId: role === "gym_staff" ? account.gym_id || null : null,
      username: account.username,
      displayName: account.display_name,
      isSuperAdmin: role === "super_admin",
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
