import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Announcement = {
  start_date?: string | null;
  end_date?: string | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isWithinDateRange(item: Announcement) {
  const today = todayString();

  if (item.start_date && item.start_date > today) return false;
  if (item.end_date && item.end_date < today) return false;

  return true;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_announcements")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;

    return NextResponse.json(
      {
        announcements: (result.data || [])
          .filter(isWithinDateRange)
          .slice(0, 5),
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
        error: "Could not load announcements.",
      },
      { status: 500 }
    );
  }
}
