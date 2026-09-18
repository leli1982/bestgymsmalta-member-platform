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

function dbGymToAdminGym(gym: any) {
  return {
    id: gym.id,
    name: gym.name,
    shortName: gym.short_name,
    publicEnrollmentSlug: gym.public_enrollment_slug || "",
    joinPath: gym.public_enrollment_slug ? `/join/${gym.public_enrollment_slug}` : null,
    staffPath: gym.public_enrollment_slug ? `/staff/${gym.public_enrollment_slug}` : null,
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

async function rollbackProvisionedGym(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  gymId: string,
  systemUserId?: string
) {
  if (systemUserId) {
    await supabase.from("bgm_system_users").delete().eq("id", systemUserId);
  }
  await supabase.from("bgm_gyms").delete().eq("id", gymId);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_gyms")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (result.error) throw result.error;

    return NextResponse.json({
      gyms: (result.data || []).map(dbGymToAdminGym),
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
        gyms: (result.data || []).map(dbGymToAdminGym),
      });
    }

    if (mode === "create") {
      const gym = body.gym || {};
      const staffPassword = String(body.staffPassword || "");
      if (staffPassword.length < 8) {
        return NextResponse.json(
          { error: "The gym staff password must be at least 8 characters." },
          { status: 400 }
        );
      }

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

      let systemUserId = "";
      try {
        const passwordHash = await bcrypt.hash(staffPassword, 12);
        const userResult = await supabase
          .from("bgm_system_users")
          .insert({
            gym_id: identity.gymId,
            username: identity.staffUsername,
            password_hash: passwordHash,
            display_name: identity.staffDisplayName,
            is_super_admin: false,
            active: true,
          })
          .select("id, gym_id, username, display_name, active")
          .single();

        if (userResult.error) throw userResult.error;
        systemUserId = userResult.data.id;

        const permissionResult = await supabase.from("bgm_user_permissions").insert(
          GYM_STAFF_PERMISSIONS.map((permissionKey) => ({
            system_user_id: systemUserId,
            permission_key: permissionKey,
            allowed: true,
          }))
        );
        if (permissionResult.error) throw permissionResult.error;

        if (auth.context) {
          const auditResult = await supabase.from("bgm_audit_log").insert({
            system_user_id: auth.context.systemUserId,
            context_gym_id: identity.gymId,
            staff_name: auth.context.displayName,
            action_key: "gym.provisioned",
            entity_type: "gym",
            entity_id: identity.gymId,
            after_data: {
              gymId: identity.gymId,
              gymName: payload.name,
              publicEnrollmentSlug: identity.routeSlug,
              joinPath: identity.joinPath,
              staffPath: identity.staffPath,
              systemUserId,
              systemUsername: identity.staffUsername,
            },
          });
          if (auditResult.error) throw auditResult.error;
        }

        return NextResponse.json(
          {
            gym: dbGymToAdminGym(gymResult.data),
            staff: {
              id: userResult.data.id,
              username: userResult.data.username,
              displayName: userResult.data.display_name,
              active: Boolean(userResult.data.active),
            },
            joinPath: identity.joinPath,
            staffPath: identity.staffPath,
          },
          { status: 201 }
        );
      } catch (error) {
        await rollbackProvisionedGym(supabase, identity.gymId, systemUserId || undefined);
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

    if (mode === "update") {
      const gym = body.gym || {};
      const requestedId = clean(gym.id);

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
        .select("id, public_enrollment_slug")
        .eq("id", requestedId)
        .maybeSingle();
      if (currentResult.error) throw currentResult.error;
      if (!currentResult.data) {
        return NextResponse.json({ error: "Gym not found." }, { status: 404 });
      }

      const payload = appGymToDbGym({
        ...gym,
        id: requestedId,
        publicEnrollmentSlug:
          currentResult.data.public_enrollment_slug ||
          buildGymProvisioningIdentity({
            name: clean(gym.name),
            shortName: clean(gym.shortName || gym.short_name),
          }).routeSlug,
      });

      const result = await supabase
        .from("bgm_gyms")
        .update(payload)
        .eq("id", requestedId)
        .select()
        .single();

      if (result.error) throw result.error;

      return NextResponse.json({
        gym: dbGymToAdminGym(result.data),
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
          { error: "Disable/remove the gym staff account before deleting this gym." },
          { status: 409 }
        );
      }

      const result = await supabase.from("bgm_gyms").delete().eq("id", id);
      if (result.error) throw result.error;

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Gym admin action failed." },
      { status: 500 }
    );
  }
}
