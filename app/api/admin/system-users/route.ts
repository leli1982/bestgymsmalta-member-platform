import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";
import { normalizeSystemUsername } from "@/lib/systemPermissions";
import {
  resolveSystemUserPermissions,
  validateSystemUserDraft,
  type SystemUserRole,
} from "@/lib/systemUserCore";

export const dynamic = "force-dynamic";

async function requireBootstrapAdminOrSuperAdmin(request: NextRequest) {
  if (isAdminRequest(request)) return { bootstrapAdmin: true, context: null, error: null };

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
      error: NextResponse.json({ error: "Super Admin access is required." }, { status: 403 }),
    };
  }

  return { bootstrapAdmin: false, context, error: null };
}

async function replaceFixedRolePermissions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  systemUserId: string,
  role: SystemUserRole
) {
  const permissions = resolveSystemUserPermissions(role);
  const deleteResult = await supabase.from("bgm_user_permissions").delete().eq("system_user_id", systemUserId);
  if (deleteResult.error) throw deleteResult.error;

  if (permissions.length > 0) {
    const insertResult = await supabase.from("bgm_user_permissions").insert(
      permissions.map((permissionKey) => ({
        system_user_id: systemUserId,
        permission_key: permissionKey,
        allowed: true,
      }))
    );
    if (insertResult.error) throw insertResult.error;
  }

  return permissions;
}

async function validateGymIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  gymIds: string[]
) {
  if (gymIds.length === 0) return [];
  const result = await supabase.from("bgm_gyms").select("id,name").in("id", gymIds);
  if (result.error) throw result.error;
  if ((result.data || []).length !== gymIds.length) {
    throw new Error("One or more assigned gyms do not exist.");
  }
  return result.data || [];
}

async function replaceManagerAssignments(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  managerUserId: string,
  gymIds: string[],
  actorSystemUserId: string | null
) {
  await validateGymIds(supabase, gymIds);
  const deleteResult = await supabase
    .from("bgm_manager_gym_assignments")
    .delete()
    .eq("manager_user_id", managerUserId);
  if (deleteResult.error) throw deleteResult.error;

  if (gymIds.length > 0) {
    const insertResult = await supabase.from("bgm_manager_gym_assignments").insert(
      gymIds.map((gymId) => ({
        manager_user_id: managerUserId,
        gym_id: gymId,
        assigned_by_system_user_id: actorSystemUserId,
      }))
    );
    if (insertResult.error) throw insertResult.error;
  }
}

async function loadUsers() {
  const supabase = getSupabaseAdmin();
  const [usersResult, gymsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("bgm_system_users")
      .select("id, gym_id, username, display_name, is_super_admin, active, role, last_login_at, created_at, updated_at")
      .order("is_super_admin", { ascending: false })
      .order("display_name", { ascending: true }),
    supabase.from("bgm_gyms").select("id, name"),
    supabase.from("bgm_manager_gym_assignments").select("manager_user_id,gym_id"),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (gymsResult.error) throw gymsResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const gymMap = new Map((gymsResult.data || []).map((gym) => [gym.id as string, gym.name as string]));
  const assignmentsByManager = new Map<string, string[]>();
  for (const assignment of assignmentsResult.data || []) {
    const current = assignmentsByManager.get(String(assignment.manager_user_id)) || [];
    current.push(String(assignment.gym_id));
    assignmentsByManager.set(String(assignment.manager_user_id), current);
  }

  return (usersResult.data || []).map((user) => {
    const role: SystemUserRole = user.is_super_admin || user.role === "super_admin"
      ? "super_admin"
      : user.role === "gym_manager"
        ? "gym_manager"
        : "gym_staff";
    const managerGymIds = role === "gym_manager"
      ? (assignmentsByManager.get(String(user.id)) || []).sort()
      : [];
    return {
      id: user.id,
      gymId: role === "gym_staff" ? user.gym_id || null : null,
      gymName: role === "gym_staff" && user.gym_id ? gymMap.get(user.gym_id) || user.gym_id : null,
      managerGymIds,
      managerGymNames: managerGymIds.map((gymId) => gymMap.get(gymId) || gymId),
      username: user.username,
      displayName: user.display_name,
      isSuperAdmin: role === "super_admin",
      role,
      active: Boolean(user.active),
      permissions: resolveSystemUserPermissions(role),
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  });
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
    return NextResponse.json({ error: "Could not load system users." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const validation = validateSystemUserDraft({
      gymId: body.gymId,
      managerGymIds: body.managerGymIds,
      username: body.username,
      displayName: body.displayName,
      password: body.password,
      isSuperAdmin: body.isSuperAdmin,
      role: body.role,
    });
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (validation.gymId) {
      const gymResult = await supabase.from("bgm_gyms").select("id").eq("id", validation.gymId).maybeSingle();
      if (gymResult.error) throw gymResult.error;
      if (!gymResult.data) return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }
    if (validation.role === "gym_manager") {
      try {
        await validateGymIds(supabase, validation.managerGymIds);
      } catch {
        return NextResponse.json({ error: "One or more assigned gyms do not exist." }, { status: 400 });
      }
    }

    const existingResult = await supabase.from("bgm_system_users").select("id").eq("username", validation.username).maybeSingle();
    if (existingResult.error) throw existingResult.error;
    if (existingResult.data) return NextResponse.json({ error: "That system username is already in use." }, { status: 409 });

    const passwordHash = await bcrypt.hash(String(body.password), 12);
    const insertResult = await supabase
      .from("bgm_system_users")
      .insert({
        gym_id: validation.gymId,
        username: validation.username,
        password_hash: passwordHash,
        display_name: validation.displayName,
        is_super_admin: validation.role === "super_admin",
        role: validation.role,
        active: true,
      })
      .select("id, gym_id, username, display_name, is_super_admin, active, role")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return NextResponse.json({ error: "That gym already has a system login, or the username is already in use." }, { status: 409 });
      }
      throw insertResult.error;
    }

    try {
      if (validation.role !== "super_admin") {
        await replaceFixedRolePermissions(supabase, insertResult.data.id, validation.role);
      }
      if (validation.role === "gym_manager") {
        await replaceManagerAssignments(
          supabase,
          insertResult.data.id,
          validation.managerGymIds,
          auth.context?.systemUserId || null
        );
      }
    } catch (error) {
      await supabase.from("bgm_system_users").delete().eq("id", insertResult.data.id);
      throw error;
    }

    const permissions = resolveSystemUserPermissions(validation.role);
    await writeAudit(auth.context, "system_user.created", insertResult.data.id, {
      gymId: validation.gymId,
      managerGymIds: validation.managerGymIds,
      username: insertResult.data.username,
      displayName: insertResult.data.display_name,
      isSuperAdmin: validation.role === "super_admin",
      role: validation.role,
      permissions,
    });

    return NextResponse.json({
      user: {
        id: insertResult.data.id,
        gymId: validation.gymId,
        managerGymIds: validation.managerGymIds,
        username: insertResult.data.username,
        displayName: insertResult.data.display_name,
        isSuperAdmin: validation.role === "super_admin",
        role: validation.role,
        active: Boolean(insertResult.data.active),
        permissions,
      },
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create system user." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing system user ID." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const currentResult = await supabase
      .from("bgm_system_users")
      .select("id, gym_id, username, display_name, is_super_admin, active, role")
      .eq("id", id)
      .maybeSingle();
    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) return NextResponse.json({ error: "System user not found." }, { status: 404 });

    const currentRole: SystemUserRole = currentResult.data.is_super_admin || currentResult.data.role === "super_admin"
      ? "super_admin"
      : currentResult.data.role === "gym_manager"
        ? "gym_manager"
        : "gym_staff";

    // Prevent accidental lockout: keep at least one active Super Admin and
    // do not allow a logged-in administrator to disable their own account.
    if (body.active === false && currentRole === "super_admin" && currentResult.data.active) {
      if (auth.context?.systemUserId === id) {
        return NextResponse.json({ error: "You cannot disable your own Super Admin account." }, { status: 400 });
      }
      const activeAdmins = await supabase.from("bgm_system_users")
        .select("id", { count: "exact", head: true })
        .eq("is_super_admin", true).eq("active", true);
      if (activeAdmins.error) throw activeAdmins.error;
      if ((activeAdmins.count || 0) <= 1) {
        return NextResponse.json({ error: "At least one active Super Admin must remain." }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.username !== undefined) {
      const username = normalizeSystemUsername(String(body.username));
      if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });
      updates.username = username;
    }
    if (body.displayName !== undefined) {
      const displayName = String(body.displayName || "").trim();
      if (!displayName) return NextResponse.json({ error: "Display name is required." }, { status: 400 });
      updates.display_name = displayName;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.password !== undefined) {
      const password = String(body.password || "");
      if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    let nextManagerGymIds: string[] | null = null;
    if (body.managerGymIds !== undefined) {
      if (currentRole !== "gym_manager") {
        return NextResponse.json({ error: "Gym assignments can only be changed for Gym Manager accounts." }, { status: 400 });
      }
      nextManagerGymIds = Array.from(new Set(
        (Array.isArray(body.managerGymIds) ? body.managerGymIds : [])
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      ));
      if (nextManagerGymIds.length === 0) {
        return NextResponse.json({ error: "At least one gym must remain assigned to a Gym Manager." }, { status: 400 });
      }
      try {
        await validateGymIds(supabase, nextManagerGymIds);
      } catch {
        return NextResponse.json({ error: "One or more assigned gyms do not exist." }, { status: 400 });
      }
    }

    const updateResult = await supabase
      .from("bgm_system_users")
      .update(updates)
      .eq("id", id)
      .select("id, gym_id, username, display_name, is_super_admin, active, role")
      .single();

    if (updateResult.error) {
      if (updateResult.error.code === "23505") return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
      throw updateResult.error;
    }

    if (currentRole !== "super_admin") await replaceFixedRolePermissions(supabase, id, currentRole);
    if (currentRole === "gym_manager" && nextManagerGymIds) {
      await replaceManagerAssignments(supabase, id, nextManagerGymIds, auth.context?.systemUserId || null);
    }

    let managerGymIds: string[] = [];
    if (currentRole === "gym_manager") {
      const assignmentResult = await supabase.from("bgm_manager_gym_assignments")
        .select("gym_id").eq("manager_user_id", id).order("gym_id", { ascending: true });
      if (assignmentResult.error) throw assignmentResult.error;
      managerGymIds = (assignmentResult.data || []).map((row) => String(row.gym_id));
    }

    const permissions = resolveSystemUserPermissions(currentRole);
    await writeAudit(auth.context, "system_user.updated", id, {
      username: updateResult.data.username,
      displayName: updateResult.data.display_name,
      active: Boolean(updateResult.data.active),
      role: currentRole,
      managerGymIds,
      permissions,
    });

    return NextResponse.json({
      user: {
        id: updateResult.data.id,
        gymId: currentRole === "gym_staff" ? updateResult.data.gym_id || null : null,
        managerGymIds,
        username: updateResult.data.username,
        displayName: updateResult.data.display_name,
        isSuperAdmin: currentRole === "super_admin",
        role: currentRole,
        active: Boolean(updateResult.data.active),
        permissions,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update system user." }, { status: 500 });
  }
}
