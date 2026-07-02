import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type ContentType = "announcement" | "tsm";

function isAdmin(request: NextRequest) {
  const expectedPin = process.env.BGM_ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");

  return Boolean(expectedPin && suppliedPin && suppliedPin === expectedPin);
}

function tableForType(type: ContentType) {
  return type === "announcement"
    ? "bgm_announcements"
    : "bgm_tsm_spotlights";
}

function cleanPayload(type: ContentType, payload: Record<string, unknown>) {
  if (type === "announcement") {
    return {
      title: String(payload.title || "").trim(),
      message: String(payload.message || "").trim(),
      category: String(payload.category || "Update").trim(),
      image_url: String(payload.image_url || "").trim() || null,
      button_text: String(payload.button_text || "").trim() || null,
      button_url: String(payload.button_url || "").trim() || null,
      active: Boolean(payload.active),
      start_date: String(payload.start_date || "").trim() || null,
      end_date: String(payload.end_date || "").trim() || null,
      sort_order: Number(payload.sort_order || 0),
    };
  }

  return {
    product_name: String(payload.product_name || "").trim(),
    description: String(payload.description || "").trim(),
    image_url: String(payload.image_url || "").trim() || null,
    price_or_note: String(payload.price_or_note || "").trim() || null,
    button_text: String(payload.button_text || "Message us").trim(),
    button_url:
      String(payload.button_url || "https://m.me/bestgymsmalta").trim(),
    active: Boolean(payload.active),
    sort_order: Number(payload.sort_order || 0),
  };
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [announcementsResult, tsmResult] = await Promise.all([
      supabase
        .from("bgm_announcements")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),

      supabase
        .from("bgm_tsm_spotlights")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    if (announcementsResult.error) throw announcementsResult.error;
    if (tsmResult.error) throw tsmResult.error;

    return NextResponse.json({
      announcements: announcementsResult.data || [],
      tsmSpotlights: tsmResult.data || [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load admin content." },
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

    const type = body.type as ContentType;
    const mode = String(body.mode || "");
    const table = tableForType(type);
    const payload = cleanPayload(type, body.item || {});

    if (mode === "create") {
      const result = await supabase.from(table).insert(payload).select().single();
      if (result.error) throw result.error;
      return NextResponse.json({ item: result.data });
    }

    if (mode === "update") {
      const id = String(body.item?.id || "");
      if (!id) {
        return NextResponse.json({ error: "Missing ID." }, { status: 400 });
      }

      const result = await supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (result.error) throw result.error;
      return NextResponse.json({ item: result.data });
    }

    if (mode === "delete") {
      const id = String(body.id || "");
      if (!id) {
        return NextResponse.json({ error: "Missing ID." }, { status: 400 });
      }

      const result = await supabase.from(table).delete().eq("id", id);
      if (result.error) throw result.error;

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Admin action failed." },
      { status: 500 }
    );
  }
}
