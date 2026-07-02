import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isWithinDateRange(item: {
  start_date?: string | null;
  end_date?: string | null;
}) {
  const today = new Date();
  const start = item.start_date ? new Date(item.start_date) : null;
  const end = item.end_date ? new Date(item.end_date) : null;

  if (start && start > today) return false;
  if (end && end < today) return false;

  return true;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [announcementsResult, tsmResult] = await Promise.all([
      supabase
        .from("bgm_announcements")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),

      supabase
        .from("bgm_tsm_spotlights")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    if (announcementsResult.error) throw announcementsResult.error;
    if (tsmResult.error) throw tsmResult.error;

    return NextResponse.json(
      {
        announcements: (announcementsResult.data || [])
          .filter(isWithinDateRange)
          .slice(0, 5),
        tsmSpotlights: (tsmResult.data || []).slice(0, 3),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        announcements: [],
        tsmSpotlights: [],
        error: "Could not load live content.",
      },
      { status: 500 }
    );
  }
}
