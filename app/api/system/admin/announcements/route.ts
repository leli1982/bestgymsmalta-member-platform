import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
type Mode = "create" | "update" | "delete";
const clean = (value: unknown) => String(value ?? "").trim();
const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
function safeLink(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}
function validate(raw: Record<string, unknown>) {
  const title = clean(raw.title);
  const message = clean(raw.message);
  const category = clean(raw.category) || "Update";
  const imageUrl = clean(raw.image_url);
  const buttonText = clean(raw.button_text);
  const buttonUrl = clean(raw.button_url);
  const start = clean(raw.start_date);
  const end = clean(raw.end_date);
  const sortOrder = Number(raw.sort_order ?? 0);
  if (!title || !message) throw new Error("Enter an announcement title and message.");
  if (title.length > 200 || message.length > 8000 || category.length > 120)
    throw new Error("Announcement text exceeds its permitted length.");
  if (!validDate(start) || !validDate(end) || (start && end && end < start))
    throw new Error("Enter a valid start/end date range.");
  if (!safeLink(imageUrl) || !safeLink(buttonUrl))
    throw new Error("Use a valid HTTPS/HTTP URL or an app-relative path.");
  if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl))
    throw new Error("Provide both the button label and its link, or leave both blank.");
  if (buttonText.length > 120 || !Number.isSafeInteger(sortOrder) || Math.abs(sortOrder) > 1000000)
    throw new Error("Check the button label and display order.");
  return {
    title, message, category, image_url: imageUrl || null,
    button_text: buttonText || null, button_url: buttonUrl || null,
    active: raw.active === true, start_date: start || null, end_date: end || null,
    sort_order: sortOrder, updated_at: new Date().toISOString(),
  };
}
async function requireSuperAdmin(request: NextRequest) {
  const user = await getSystemContext(request);
  return Boolean(user?.isSuperAdmin);
}
export async function GET(request: NextRequest) {
  if (!(await requireSuperAdmin(request)))
    return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  try {
    const result = await getSupabaseAdmin().from("bgm_announcements").select("*")
      .order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return NextResponse.json({ announcements: result.data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Announcement listing failed", error);
    return NextResponse.json({ error: "Could not load announcements." }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  if (!(await requireSuperAdmin(request)))
    return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const mode = clean(body.mode) as Mode;
  if (!["create", "update", "delete"].includes(mode))
    return NextResponse.json({ error: "Invalid announcement action." }, { status: 400 });
  const id = clean(body.id || body.item?.id);
  if (mode !== "create" && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))
    return NextResponse.json({ error: "Invalid announcement ID." }, { status: 400 });
  let values: ReturnType<typeof validate> | null = null;
  if (mode !== "delete") {
    try { values = validate(body.item || {}); }
    catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid announcement." }, { status: 400 });
    }
  }
  try {
    const db = getSupabaseAdmin().from("bgm_announcements");
    if (mode === "delete") {
      const result = await db.delete().eq("id", id).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    const result = mode === "create"
      ? await db.insert(values!).select("*").single()
      : await db.update(values!).eq("id", id).select("*").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    return NextResponse.json({ item: result.data });
  } catch (error) {
    console.error("Announcement save failed", error);
    return NextResponse.json({ error: "Could not save announcement." }, { status: 500 });
  }
}
