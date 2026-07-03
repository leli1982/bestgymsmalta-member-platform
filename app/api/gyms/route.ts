import { NextResponse } from "next/server";
import { gyms as fallbackGyms } from "@/components/data/gyms";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function dbGymToAppGym(gym: any) {
  return {
    id: gym.id,
    name: gym.name,
    shortName: gym.short_name,
    status: gym.status,
    city: gym.city || "",
    address: gym.address || "",
    latitude: gym.latitude,
    longitude: gym.longitude,
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
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_gyms")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (result.error) throw result.error;

    const liveGyms = (result.data || []).map(dbGymToAppGym);

    return NextResponse.json({
      gyms: liveGyms.length > 0 ? liveGyms : fallbackGyms,
      source: liveGyms.length > 0 ? "supabase" : "fallback",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      gyms: fallbackGyms,
      source: "fallback",
      error: "Could not load live gym data.",
    });
  }
}
