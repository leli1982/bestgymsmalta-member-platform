import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { DEFAULT_MEMBER_HERO_POSITION, parseMemberHeroPosition } from "@/lib/memberHeroPosition";
import {
  MEMBER_HERO_BUCKET, MEMBER_HERO_MAX_BYTES, MEMBER_HERO_MIME,
  memberHeroPublicUrl, validMemberHeroImage,
} from "@/lib/memberDashboardHero";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function guard(request: NextRequest) {
  const { context, error } = await requireSuperAdmin(request);
  if (error) return { context: null, error };
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return { context: null, error: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }) };
  }
  return { context, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const { context, error } = await guard(request);
    if (error) return error;
    if (!context) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const form = await request.formData().catch(() => null);
    const position = parseMemberHeroPosition(form?.get("positionX"), form?.get("positionY"));
    if (!position) {
      return NextResponse.json({ error: "Invalid image position. Use 0–100 percent on each axis." }, { status: 400 });
    }
    const file = form?.get("file");
    if (!(file instanceof File) || !MEMBER_HERO_MIME[file.type] || file.size < 1 || file.size > MEMBER_HERO_MAX_BYTES) {
      return NextResponse.json({ error: "Choose a JPG, PNG or WebP image up to 5 MB." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validMemberHeroImage(bytes, file.type)) {
      return NextResponse.json({ error: "The file is not a valid image of the selected type." }, { status: 400 });
    }
    const db = getSupabaseAdmin();
    const path = `home-hero/${randomUUID()}.${MEMBER_HERO_MIME[file.type]}`;
    const uploaded = await db.storage.from(MEMBER_HERO_BUCKET).upload(path, bytes, {
      contentType: file.type, cacheControl: "31536000", upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const saved = await db.from("bgm_member_dashboard_hero")
      .upsert({
        id: 1, image_path: path, position_x: position.x, position_y: position.y, updated_at: new Date().toISOString(),
        updated_by: context.systemUserId,
      }, { onConflict: "id" });
    if (saved.error) {
      await db.storage.from(MEMBER_HERO_BUCKET).remove([path]);
      throw saved.error;
    }
    return NextResponse.json({ ok: true, imageUrl: memberHeroPublicUrl(path), positionX: position.x, positionY: position.y }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Member dashboard hero publish failed", error);
    return NextResponse.json({ error: "Could not publish the new image. The previous image remains selected." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { context, error } = await guard(request);
    if (error) return error;
    if (!context) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const body = await request.json().catch(() => null);
    const position = parseMemberHeroPosition(body?.positionX, body?.positionY);
    if (!position) {
      return NextResponse.json({ error: "Invalid image position. Use 0–100 percent on each axis." }, { status: 400 });
    }
    // Do not change image_path: adjusting the crop must not reupload or replace artwork.
    const saved = await getSupabaseAdmin().from("bgm_member_dashboard_hero")
      .update({
        position_x: position.x,
        position_y: position.y,
        updated_at: new Date().toISOString(),
        updated_by: context.systemUserId,
      })
      .eq("id", 1)
      .select("id")
      .maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return NextResponse.json({ error: "Image setting not found." }, { status: 404 });
    return NextResponse.json({ ok: true, positionX: position.x, positionY: position.y }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Member dashboard hero position save failed", error);
    return NextResponse.json({ error: "Could not save the image position." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { context, error } = await guard(request);
    if (error) return error;
    if (!context) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getSupabaseAdmin();
    const saved = await db.from("bgm_member_dashboard_hero").upsert({
      id: 1, image_path: null, position_x: DEFAULT_MEMBER_HERO_POSITION.x, position_y: DEFAULT_MEMBER_HERO_POSITION.y,
      updated_at: new Date().toISOString(),
      updated_by: context.systemUserId,
    }, { onConflict: "id" });
    if (saved.error) throw saved.error;
    return NextResponse.json({ ok: true, imageUrl: null, positionX: DEFAULT_MEMBER_HERO_POSITION.x, positionY: DEFAULT_MEMBER_HERO_POSITION.y }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Member dashboard hero reset failed", error);
    return NextResponse.json({ error: "Could not restore the original image." }, { status: 500 });
  }
}
