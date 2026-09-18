import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { gyms as fallbackGyms } from "@/components/data/gyms";
import { buildGymProvisioningIdentity } from "@/lib/gymProvisioningCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { defaultGymTourLinks } from "@/lib/gymVirtualTours";
import { requireAdmin } from "@/lib/adminAuth";
import { getSystemContext } from "@/lib/systemAuth";
import { GYM_STAFF_PERMISSIONS } from "@/lib/systemPermissions";

export const dynamic = "force-dynamic";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

async function requireAdminOrSuperAdmin(request: NextRequest) {
  if (requireAdmin(request) === null) {
    return { context: null, error: null };
  }

  const context = await getSystemContext(request);
  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "Not authorised." }, { status: 401 }),
    };
  }
  if (!context.isSuperAdmin) {
    return {
      context: null,
      error: NextResponse.json({ error: "Super Admin access is required." }, { status: 403 }),
    };
  }
  return { context, error: null };
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function routeSlugForGym(gym: any) {
  const supplied = clean(gym.publicEnrollmentSlug || gym.public_enrollment_slug);
  if (supplied) return supplied;
  try {
    return buildGymProvisioningIdentity({
      name: clean(gym.name),
      shortName: clean(gym.shortName || gym.short_name),
    }).routeSlug;
  } catch {
    return null;
  }
}

function appGymToDbGym(gym: any, index = 0) {
  return {
    id: String(gym.id || "").trim(),
    name: String(gym.name || "").trim(),
    short_name: String(gym.shortName || gym.short_name || gym.name || "").trim(),
    public_enrollment_slug: routeSlugForGym(gym),
    status: gym.status || "active",
    city: gym.city || "",
    address: gym.address || "",
    latitude:
      gym.latitude === "" || gym.latitude === null || gym.latitude === undefined
        ? null
        : Number(gym.latitude),
    longitude:
      gym.longitude === "" || gym.longitude === null || gym.longitude === undefined
        ? null
        : Number(gym.longitude),
    opening_hours: gym.openingHours || gym.opening_hours || "",
    phone: gym.phone || "",
    email: gym.email || "",
    logo: gym.logo || "",
    virtual_tour_url:
      gym.virtualTourUrl ||
      gym.virtual_tour_url ||
      defaultGymTourLinks[gym.id] ||
      "",
    accent_color: gym.accentColor || gym.accent_color || "#fcb415",
    qr_code_id: gym.qrCodeId || gym.qr_code_id || gym.id,
    facilities: Array.isArray(gym.facilities)
      ? gym.facilities
      : String(gym.facilities || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    classes: Array.isArray(gym.classes)
      ? gym.classes
      : String(gym.classes || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    featured_equipment: Array.isArray(gym.featuredEquipment)
      ? gym.featuredEquipment
      : Array.isArray(gym.featured_equipment)
        ? gym.featured_equipment
        : String(gym.featuredEquipment || gym.featured_equipment || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
    notes: gym.notes || "",
    sort_order: Number(gym.sort_order ?? gym.sortOrder ?? index),
    updated_at: new Date().toISOString(),
  };
}

function dbGymToAdminGym(gym: any, staff?: any) {
  return {
    id: gym.id,
    name: gym.name,
    shortName: gym.short_name,
    publicEnrollmentSlug: gym.public_enrollment_slug || "",
    joinPath: gym.public_enrollment_slug ? `/join/${gym.public_enrollment_slug}` : null,
    staffPath: gym.public_enrollment_slug ? `/staff/${gym.public_enrollment_slug}` : null,
    staffProvisioned: Boolean(staff?.id),
    staffUsername: staff?.username || null,
    staffActive: Boolean(staff?.active),
    status: gym.status,
    city: gym.city || "",
    address: gym.address || "",
    latitude: gym.latitude ?? "",
    longitude: gym.longitude ?? "",
    openingHours: gym.opening_hours || "",
    phone: gym.phone || "",
    email: gym.email || "",
    logo: gym.logo || "",
    virtualTourUrl: gym.virtual_tour_url || defaultGymTourLinks[gym.id] || "",
    virtual_tour_url: gym.virtual_tour_url || defaultGymTourLinks[gym.id] || "",
    accentColor: gym.accent_color || "#fcb415",
    qrCodeId: gym.qr_code_id || gym.id,
    facilities: gym.facilities || [],
    classes: gym.classes || [],
    featuredEquipment: gym.featured_equipment || [],
    notes: gym.notes || "",
    sortOrder: gym.sort_order || 0,
  };
}

async function getGymStaff(supabase: SupabaseAdmin, gymId: string) {
  const result = await supabase
    .from("bgm_system_users")
    .select("id,gym_id,username,display_name,active")
    .eq("gym_id", gymId)
    .eq("is_super_admin", false)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function provisionGymStaffAccount({
  supabase,
  gymId,
  gymName,
  shortName,
  staffPassword,
  active,
}: {
  supabase: SupabaseAdmin;
  gymId: string;
  gymName: string;
  shortName: string;
  staffPassword: string;
  active: boolean;
}) {
  if (staffPassword.length < 8) {
    throw new Error("STAFF_PASSWORD_REQUIRED");
  }

  const identity = buildGymProvisioningIdentity({ name: gymName, shortName });
  const passwordHash = await bcrypt.hash(staffPassword, 12);
  const userResult = await supabase
    .from("bgm_system_users")
    .insert({
      gym_id: gymId,
      username: identity.staffUsername,
      password_hash: passwordHash,
      display_name: identity.staffDisplayName,
      is_super_admin: false,
      active,
    })
    .select("id,gym_id,username,display_name,active")
    .single();

  if (userResult.error) throw userResult.error;

  const permissionResult = await supabase.from("bgm_user_permissions").insert(
    GYM_STAFF_PERMISSIONS.map((permissionKey) => ({
      system_user_id: userResult.data.id,
      permission_key: permissionKey,
      allowed: true,
    }))
  );

  if (permissionResult.error) {
    await supabase.from("bgm_system_users").delete().eq("id", userResult.data.id);
    throw permissionResult.error;
  }

  return userResult.data;
}

async function writeProvisionAudit(
  supabase: SupabaseAdmin,
  context: Awaited<ReturnType<typeof getSystemContext>>,
  data: {
    gymId: string;
    gymName: string;
    routeSlug: string;
    joinPath: string;
    staffPath: string;
    systemUserId: string | null;
    systemUsername: string | null;
    reason: "created_active" | "activated_existing";
  }
) {
  if (!context) return;

  const result = await supabase.from("bgm_audit_log").insert({
    system_user_id: context.systemUserId,
    context_gym_id: data.gymId,
    staff_name: context.displayName,
    action_key: "gym.provisioned",
    entity_type: "gym",
    entity_id: data.gymId,
    after_data: data,
  });
  if (result.error) throw result.error;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabaseAdmin();

    const [gymsResult, staffResult] = await Promise.all([
      supabase
        .from("bgm_gyms")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("bgm_system_users")
        .select("id,gym_id,username,display_name,active")
        .eq("is_super_admin", false),
    ]);

    if (gymsResult.error) throw gymsResult.error;
    if (staffResult.error) throw staffResult.error;

    const staffByGym = new Map(
      (staffResult.data || [])
        .filter((staff) => staff.gym_id)
        .map((staff) => [staff.gym_id as string, staff])
    );

    return NextResponse.json({
      gyms: (gymsResult.data || []).map((gym) =>
        dbGymToAdminGym(gym, staffByGym.get(gym.id))
      ),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not load gyms." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const mode = String(body.mode || "");

    if (mode === "seed") {
      const rows = fallbackGyms.map((gym, index) => appGymToDbGym(gym, index));

      const result = await supabase
        .from("bgm_gyms")
        .upsert(rows, { onConflict: "id" })
        .select();

      if (result.error) throw result.error;

      return NextResponse.json({
        ok: true,
        gyms: (result.data || []).map((gym) => dbGymToAdminGym(gym)),
      });
    }

    if (mode === "create") {
      const gym = body.gym || {};
      const targetStatus = clean(gym.status) || "coming_soon";
      const staffPassword = String(body.staffPassword || "");
      let identity;

      try {
        identity = buildGymProvisioningIdentity({
          name: clean(gym.name),
          shortName: clean(gym.shortName || gym.short_name),
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "A valid gym name is required." },
          { status: 400 }
        );
      }

      if (targetStatus === "active" && staffPassword.length < 8) {
        return NextResponse.json(
          { error: "Set a staff password of at least 8 characters before activating this gym." },
          { status: 400 }
        );
      }

      const payload = appGymToDbGym({
        ...gym,
        id: identity.gymId,
        publicEnrollmentSlug: identity.routeSlug,
        qrCodeId: identity.gymId,
      });

      const gymResult = await supabase
        .from("bgm_gyms")
        .insert(payload)
        .select()
        .single();

      if (gymResult.error) {
        if (gymResult.error.code === "23505") {
          return NextResponse.json(
            { error: "A gym with that name/route already exists." },
            { status: 409 }
          );
        }
        throw gymResult.error;
      }

      let staff = null;
      try {
        if (targetStatus === "active") {
          staff = await provisionGymStaffAccount({
            supabase,
            gymId: identity.gymId,
            gymName: payload.name,
            shortName: payload.short_name,
            staffPassword,
            active: true,
          });

          await writeProvisionAudit(supabase, auth.context, {
            gymId: identity.gymId,
            gymName: payload.name,
            routeSlug: identity.routeSlug,
            joinPath: identity.joinPath,
            staffPath: identity.staffPath,
            systemUserId: staff.id,
            systemUsername: staff.username,
            reason: "created_active",
          });
        }

        return NextResponse.json(
          {
            gym: dbGymToAdminGym(gymResult.data, staff),
            staff,
            joinPath: identity.joinPath,
            staffPath: identity.staffPath,
            provisioningRequired: targetStatus !== "active",
          },
          { status: 201 }
        );
      } catch (error) {
        if (staff?.id) {
          await supabase.from("bgm_system_users").delete().eq("id", staff.id);
        }
        await supabase.from("bgm_gyms").delete().eq("id", identity.gymId);
        throw error;
      }
    }

    if (mode === "update") {
      const gym = body.gym || {};
      const requestedId = clean(gym.id);
      const staffPassword = String(body.staffPassword || "");

      if (!requestedId) {
        return NextResponse.json({ error: "Missing gym ID." }, { status: 400 });
      }

      if (!clean(gym.name)) {
        return NextResponse.json(
          { error: "Missing gym name." },
          { status: 400 }
        );
      }

      const currentResult = await supabase
        .from("bgm_gyms")
        .select("id,name,short_name,status,public_enrollment_slug")
        .eq("id", requestedId)
        .maybeSingle();
      if (currentResult.error) throw currentResult.error;
      if (!currentResult.data) {
        return NextResponse.json({ error: "Gym not found." }, { status: 404 });
      }

      const currentStaff = await getGymStaff(supabase, requestedId);
      const targetStatus = clean(gym.status) || currentResult.data.status;
      const becomingActive =
        currentResult.data.status !== "active" && targetStatus === "active";
      const needsStaffProvisioning = targetStatus === "active" && !currentStaff;

      if (needsStaffProvisioning && staffPassword.length < 8) {
        return NextResponse.json(
          {
            error:
              "This gym needs a staff password of at least 8 characters before it can become active.",
            code: "STAFF_PASSWORD_REQUIRED",
          },
          { status: 400 }
        );
      }

      const stableSlug =
        currentResult.data.public_enrollment_slug ||
        buildGymProvisioningIdentity({
          name: clean(gym.name),
          shortName: clean(gym.shortName || gym.short_name),
        }).routeSlug;

      const identity = buildGymProvisioningIdentity({
        name: clean(gym.name),
        shortName: clean(gym.shortName || gym.short_name),
      });
      const payload = appGymToDbGym({
        ...gym,
        id: requestedId,
        publicEnrollmentSlug: stableSlug,
      });

      let provisionedStaff: any = null;
      if (needsStaffProvisioning) {
        try {
          provisionedStaff = await provisionGymStaffAccount({
            supabase,
            gymId: requestedId,
            gymName: payload.name,
            shortName: payload.short_name,
            staffPassword,
            active: false,
          });
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code?: string }).code === "23505"
          ) {
            return NextResponse.json(
              { error: "The generated staff login is already in use." },
              { status: 409 }
            );
          }
          throw error;
        }
      }

      const updateResult = await supabase
        .from("bgm_gyms")
        .update(payload)
        .eq("id", requestedId)
        .select()
        .single();

      if (updateResult.error) {
        if (provisionedStaff?.id) {
          await supabase.from("bgm_system_users").delete().eq("id", provisionedStaff.id);
        }
        throw updateResult.error;
      }

      const staffToUpdate = provisionedStaff || currentStaff;
      if (staffToUpdate) {
        const staffStatusResult = await supabase
          .from("bgm_system_users")
          .update({
            active: targetStatus === "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", staffToUpdate.id);
        if (staffStatusResult.error) throw staffStatusResult.error;
      }

      if (targetStatus === "active" && (becomingActive || needsStaffProvisioning)) {
        const finalStaff = provisionedStaff || currentStaff;
        await writeProvisionAudit(supabase, auth.context, {
          gymId: requestedId,
          gymName: payload.name,
          routeSlug: stableSlug,
          joinPath: `/join/${stableSlug}`,
          staffPath: `/staff/${stableSlug}`,
          systemUserId: finalStaff?.id || null,
          systemUsername: finalStaff?.username || null,
          reason: "activated_existing",
        });
      }

      return NextResponse.json({
        gym: dbGymToAdminGym(updateResult.data, {
          ...(provisionedStaff || currentStaff || {}),
          active: targetStatus === "active" && Boolean(staffToUpdate),
        }),
        joinPath: `/join/${stableSlug}`,
        staffPath: `/staff/${stableSlug}`,
        staffProvisioned: Boolean(staffToUpdate),
        staffUsername: staffToUpdate?.username || identity.staffUsername,
      });
    }

    if (mode === "delete") {
      const id = String(body.id || "").trim();

      if (!id) {
        return NextResponse.json({ error: "Missing gym ID." }, { status: 400 });
      }

      const staffResult = await supabase
        .from("bgm_system_users")
        .select("id")
        .eq("gym_id", id)
        .maybeSingle();
      if (staffResult.error) throw staffResult.error;
      if (staffResult.data) {
        return NextResponse.json(
          { error: "Remove the gym staff account before deleting this gym." },
          { status: 409 }
        );
      }

      const result = await supabase.from("bgm_gyms").delete().eq("id", id);
      if (result.error) throw result.error;

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_PASSWORD_REQUIRED") {
      return NextResponse.json(
        { error: "The gym staff password must be at least 8 characters." },
        { status: 400 }
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "Gym admin action failed." },
      { status: 500 }
    );
  }
}
