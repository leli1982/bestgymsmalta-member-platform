import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type ManifestRouteContext = {
  params: Promise<{ gymSlug: string }>;
};

function cleanGymSlug(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export async function GET(_request: Request, { params }: ManifestRouteContext) {
  const { gymSlug: rawGymSlug } = await params;
  const gymSlug = cleanGymSlug(rawGymSlug);

  if (!gymSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymSlug)) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const { data: gym, error } = await supabase
    .from("bgm_gyms")
    .select("id,name,short_name,public_enrollment_slug,status")
    .eq("public_enrollment_slug", gymSlug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Enrollment manifest gym lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (!gym) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  const manifest = {
    name: `BestGymsMalta ${gym.short_name || gym.name} Registration`,
    short_name: "BGM Registration",
    description: `New membership registration for ${gym.name}.`,
    start_url: `/join/${gymSlug}`,
    scope: "/join/",
    display: "standalone",
    background_color: "#f6f6f6",
    theme_color: "#18181b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
