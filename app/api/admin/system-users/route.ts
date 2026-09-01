import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";
import { normalizeSystemUsername } from "@/lib/systemPermissions";
import {
  sanitizeSystemPermissions,
  validateSystemUserDraft,
} from "@/lib/systemUserCore";

export const dynamic = "force-dynamic";

async function requireBootstrapAdminOrSuperAdmin(request: NextRequest) {
  if (isAdminRequest(request)) {
    return { bootstrapAdmin: true, context: null, error: null };
  }

  const context = await getSystemContext(request);

  if (!context) {
    return {
      bootstrapAdmin: false,
      context: null,
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!context.isSuperAdmin) {
    return {
      bootstrapAdmin: false,
      context: null,
      error: NextResponse.json(
        { error: "Super Admin access is required." },
        { status: 403 }
      ),
    };
  }

  return { bootstrapAdmin: false, context, error: null };
}

async function loadUsers() {
  const supabase = getSupabaseAdmin();
  const [usersResult, permissionsResult, gymsResult] = await Promise.all([
    supabase
      .from("bgm_system_users")
      .select("id, gym_id, username, display_name, is_super_admin, active, last_login_at, created_at, updated_at")
      .order("is_super_admin", { ascending: false })
      .order("display_name", { ascending: true }),
    supabase
      .from("bgm_user_permissions")
      .select("system_user_id, permission_key, allowed"),
    supabase.from("bgm_gyms").select("id, name"),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (permissionsResult.error) throw permissionsResult.error;
  if (gymsResult.error) throw gymsResult.error;

  const permissionMap = new Map<string, string[]>();
  for (const row of permissionsResult.data || []) {
    if (!row.allowed) continue;
    const list = permissionMap.get(row.system_user_id) || [];
    list.push(row.permission_key);
    permissionMap.set(row.system_user_id, list);
  }

  const gymMap = new Map(
    (gymsResult.data || []).map((gym) => [gym.id as string, gym.name as string])
  );

  return (usersResult.data || []).map((user) => ({
    id: user.id,
    gymId: user.gym_id || null,
    gymName: user.gym_id ? gymMap.get(user.gym_id) || user.gym_id : null,
    username: user.username,
    displayName: user.display_name,
    isSuperAdmin: Boolean(user.is_super_admin),
    active: Boolean(user.active),
    permissions: user.is_super_admin ? [] : permissionMap.get(user.id) || [],
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }));
}

async function writeAudit(
  actor: Awaited<ReturnType<typeof getSystemContext>>,
  actionKey: string,
  entityId: string,
  afterData: unknown
) {
  if (!actor) return;

  const supabase = getSupabaseAdmin();
  const result = await supabase.from("bgm_audit_log").insert({
    system_user_id: actor.systemUserId,
    context_gym_id: actor.gymId,
    staff_name: null,
    action_key: actionKey,
    entity_type: "system_user",
    entity_id: entityId,
    after_data: afterData,
  });

  if (result.error) throw result.error;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    return NextResponse.json({ users: await loadUsers() });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load system users." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const validation = validateSystemUserDraft({
      gymId: body.gymId,
      username: body.username,
      displayName: body.displayName,
      password: body.password,
      isSuperAdmin: body.isSuperAdmin,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (validation.gymId) {
      const gymResult = await supabase
        .from("bgm_gyms")
        .select("id")
        .eq("id", validation.gymId)
        .maybeSingle();

      if (gymResult.error) throw gymResult.error;
      if (!gymResult.data) {
        return NextResponse.json({ error: "Gym not found." }, { status: 404 });
      }
    }

    const existingResult = await supabase
      .from("bgm_system_users")
      .select("id")
      .eq("username", validation.username)
      .maybeSingle();

    if (existingResult.error) throw existingResult.error;
    if (existingResult.data) {
      return NextResponse.json(
        { error: "That system username is already in use." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(String(body.password), 12);
    const insertResult = await supabase
      .from("bgm_system_users")
      .insert({
        gym_id: validation.gymId,
        username: validation.username,
        password_hash: passwordHash,
        display_name: validation.displayName,
        is_super_admin: Boolean(body.isSuperAdmin),
        active: true,
      })
      .select("id, gym_id, username, display_name, is_super_admin, active")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return NextResponse.json(
          { error: "That gym already has a system login, or the username is already in use." },
          { status: 409 }
        );
      }
      throw insertResult.error;
    }

    const permissions = Boolean(body.isSuperAdmin)
      ? []
      : sanitizeSystemPermissions(body.permissions);

    if (permissions.length > 0) {
      const permissionResult = await supabase.from("bgm_user_permissions").insert(
        permissions.map((permissionKey) => ({
          system_user_id: insertResult.data.id,
          permission_key: permissionKey,
          allowed: true,
        }))
      );

      if (permissionResult.error) {
        await supabase
          .from("bgm_system_users")
          .delete()
          .eq("id", insertResult.data.id);
        throw permissionResult.error;
      }
    }

    await writeAudit(
      auth.context,
      "system_user.created",
      insertResult.data.id,
      {
        gymId: insertResult.data.gym_id,
        username: insertResult.data.username,
        displayName: insertResult.data.display_name,
        isSuperAdmin: Boolean(insertResult.data.is_super_admin),
        permissions,
      }
    );

    return NextResponse.json(
      {
        user: {
          id: insertResult.data.id,
          gymId: insertResult.data.gym_id || null,
          username: insertResult.data.username,
          displayName: insertResult.data.display_name,
          isSuperAdmin: Boolean(insertResult.data.is_super_admin),
          active: Boolean(insertResult.data.active),
          permissions,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create system user." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing system user ID." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const currentResult = await supabase
      .from("bgm_system_users")
      .select("id, gym_id, username, display_name, is_super_admin, active")
      .eq("id", id)
      .maybeSingle();

    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) {
      return NextResponse.json({ error: "System user not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.username !== undefined) {
      const username = normalizeSystemUsername(String(body.username));
      if (!username) {
        return NextResponse.json({ error: "Username is required." }, { status: 400 });
      }
      updates.username = username;
    }

    if (body.displayName !== undefined) {
      const displayName = String(body.displayName || "").trim();
      if (!displayName) {
        return NextResponse.json({ error: "Display name is required." }, { status: 400 });
      }
      updates.display_name = displayName;
    }

    if (body.active !== undefined) {
      updates.active = Boolean(body.active);
    }

    if (body.password !== undefined) {
      const password = String(body.password || "");
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters." },
          { status: 400 }
        );
      }
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    const updateResult = await supabase
      .from("bgm_system_users")
      .update(updates)
      .eq("id", id)
      .select("id, gym_id, username, display_name, is_super_admin, active")
      .single();

    if (updateResult.error) {
      if (updateResult.error.code === "23505") {
        return NextResponse.json(
          { error: "That username is already in use." },
          { status: 409 }
        );
      }
      throw updateResult.error;
    }

    let permissions: string[] = [];

    if (!updateResult.data.is_super_admin && body.permissions !== undefined) {
      permissions = sanitizeSystemPermissions(body.permissions);

      const deletePermissions = await supabase
        .from("bgm_user_permissions")
        .delete()
        .eq("system_user_id", id);

      if (deletePermissions.error) throw deletePermissions.error;

      if (permissions.length > 0) {
        const insertPermissions = await supabase.from("bgm_user_permissions").insert(
          permissions.map((permissionKey) => ({
            system_user_id: id,
            permission_key: permissionKey,
            allowed: true,
          }))
        );
        if (insertPermissions.error) throw insertPermissions.error;
      }
    } else if (!updateResult.data.is_super_admin) {
      const permissionResult = await supabase
        .from("bgm_user_permissions")
        .select("permission_key")
        .eq("system_user_id", id)
        .eq("allowed", true);

      if (permissionResult.error) throw permissionResult.error;
      permissions = (permissionResult.data || []).map((row) => row.permission_key);
    }

    await writeAudit(auth.context, "system_user.updated", id, {
      username: updateResult.data.username,
      displayName: updateResult.data.display_name,
      active: Boolean(updateResult.data.active),
      permissions,
    });

    return NextResponse.json({
      user: {
        id: updateResult.data.id,
        gymId: updateResult.data.gym_id || null,
        username: updateResult.data.username,
        displayName: updateResult.data.display_name,
        isSuperAdmin: Boolean(updateResult.data.is_super_admin),
        active: Boolean(updateResult.data.active),
        permissions,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update system user." },
      { status: 500 }
    );
  }
}
