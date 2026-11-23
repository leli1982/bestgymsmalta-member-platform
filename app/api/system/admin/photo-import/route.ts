import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "bgm-member-photos";
const MAX_BYTES = 5 * 1024 * 1024;

function reject(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function validWebp(bytes: Buffer) {
  return bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP";
}

/**
 * A single-image endpoint, not a bulk bypass around the established member photo
 * permissions. Every upload is rechecked under a database row lock and recorded
 * atomically with its provenance. The old photo is NEVER replaced.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return reject("Cross-origin upload is not permitted.", 403);
  }

  try {
    const fields = await request.formData();
    const memberNumber = String(fields.get("memberNumber") || "").trim().toUpperCase();
    const pkCustomer = String(fields.get("pkCustomer") || "").trim();
    const originalName = String(fields.get("sourceImage") || "").trim();
    const file = fields.get("file");
    if (!/^BGM[1-9][0-9]{3,}$/.test(memberNumber)
      || !/^[a-z0-9-]{1,50}$/i.test(pkCustomer)
      || !new RegExp("^" + pkCustomer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.(jpg|jpeg|png|webp)$", "i").test(originalName)) {
      return reject("Member number, legacy number or image filename does not match.", 400);
    }
    if (!(file instanceof File) || file.type !== "image/webp"
      || file.size < 20 || file.size > MAX_BYTES) {
      return reject("Expected a WebP photo between 20 bytes and 5 MB.", 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validWebp(bytes)) return reject("Uploaded image is not a genuine WebP file.", 415);

    // Look up the intended member explicitly. Never infer identity from names.
    const db = getSupabaseAdmin();
    const target = await db.from("bgm_members")
      .select("id, member_number, legacy_pk_customer")
      .eq("member_number", memberNumber).maybeSingle();
    if (target.error) throw target.error;
    if (!target.data) return reject("Member not found.", 404);
    if (String(target.data.legacy_pk_customer || "").trim().toLowerCase()
      !== pkCustomer.toLowerCase()) {
      return reject("Legacy number differs from this member's current record.", 409);
    }

    const objectPath = `${target.data.id}/official/legacy-import-${randomUUID()}.webp`;
    const uploaded = await db.storage.from(BUCKET).upload(objectPath, bytes, {
      upsert: false, contentType: "image/webp", cacheControl: "60",
    });
    if (uploaded.error) throw uploaded.error;

    try {
      const linked = await db.rpc("bgm_attach_legacy_import_member_photo", {
        p_member_number: memberNumber,
        p_legacy_pk_customer: pkCustomer,
        p_object_path: objectPath,
        p_system_user_id: auth.context.systemUserId,
      });
      if (linked.error) throw linked.error;
      const outcome = linked.data as { assigned?: boolean; reason?: string } | null;
      if (!outcome?.assigned) {
        await db.storage.from(BUCKET).remove([objectPath]);
        return NextResponse.json({
          ok: true, assigned: false, skipped: true,
          reason: outcome?.reason || "identity_not_verified",
        }, { status: 200 });
      }
      return NextResponse.json({ ok: true, assigned: true, memberNumber });
    } catch (error) {
      // The DB RPC is atomic. Remove only this newly staged storage object.
      const cleanup = await db.storage.from(BUCKET).remove([objectPath]);
      if (cleanup.error) console.error("Photo import orphaned storage object", objectPath, cleanup.error);
      throw error;
    }
  } catch (error) {
    console.error("BGM protected photo import failed:", error);
    return reject("Could not safely assign this photo; no existing photo was replaced.", 500);
  }
}
