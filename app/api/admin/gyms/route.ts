import { NextRequest, NextResponse } from "next/server";
import { gyms as fallbackGyms } from "@/components/data/gyms";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest) {
  const expectedPin = process.env.BGM_ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");

  return Boolean(expectedPin && suppliedPin && suppliedPin === expectedPin);
}

function appGymToDbGym(gym: any, index = 0) {
  return {
    id: gym.id,
    name: gym.name,
    short_name: gym.shortName || gym.short_name || gym.name,
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
    accent_color: gym.accentColor || gym.accent_color || "#F97316",
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
    status: gym.status,
    city: gym.city || "",
    address: gym.address || "",
    latitude: gym.latitude ?? "",
    longitude: gym.longitude ?? "",
    openingHours: gym.opening_hours || "",
    phone: gym.phone || "",
    email: gym.email || "",
    logo: gym.logo || "",
    accentColor: gym.accent_color || "#F97316",
    qrCodeId: gym.qr_code_id || gym.id,
    facilities: gym.facilities || [],
    classes: gym.classes || [],
    featuredEquipment: gym.featured_equipment || [],
    notes: gym.notes || "",
    sortOrder: gym.sort_order || 0,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

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
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

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
        gyms: result.data || [],
      });
    }

    if (mode === "update") {
      const gym = body.gym || {};
      const id = String(gym.id || "");

      if (!id) {
        return NextResponse.json({ error: "Missing gym ID." }, { status: 400 });
      }

      const payload = appGymToDbGym(gym);

      const result = await supabase
        .from("bgm_gyms")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

      if (result.error) throw result.error;

      return NextResponse.json({
        gym: dbGymToAdminGym(result.data),
      });
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
