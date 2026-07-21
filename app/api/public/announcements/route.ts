import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  category: string;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_at: string;
};

function isVisibleNow(item: AnnouncementRow) {
  const today = new Date().toISOString().slice(0, 10);

  if (!item.active) return false;
  if (item.start_date && item.start_date > today) return false;
  if (item.end_date && item.end_date < today) return false;

  return true;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_announcements")
      .select(
        "id, title, message, category, image_url, button_text, button_url, active, start_date, end_date, sort_order, created_at"
      )
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(10);

    if (result.error) throw result.error;

    const announcement =
      ((result.data || []) as AnnouncementRow[]).find(isVisibleNow) || null;

    return NextResponse.json({ announcement });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { announcement: null, error: "Could not load announcement." },
      { status: 200 }
    );
  }
}
