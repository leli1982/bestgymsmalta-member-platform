import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { loadStaffEmployee, writeStaffAudit } from "@/lib/staffEmploymentApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PHOTO_BUCKET = "bgm-staff-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { employeeId } = await params;
    const db = getSupabaseAdmin();
    const employee = await loadStaffEmployee(db, employeeId);
    if (!employee) {
      return NextResponse.json({ error: "Staff employee not found." }, { status: 404, headers: noStore });
    }
    if (!employee.photo_path) {
      return NextResponse.json({ error: "No staff photo has been captured." }, { status: 404, headers: noStore });
    }
    const downloaded = await db.storage.from(PHOTO_BUCKET).download(employee.photo_path);
    if (downloaded.error || !downloaded.data) {
      throw downloaded.error || new Error("Could not download staff photo.");
    }
    return new NextResponse(downloaded.data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load the staff photo." }, { status: 500, headers: noStore });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { employeeId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Staff photo file is required." }, { status: 400, headers: noStore });
    }
    if (file.type !== "image/webp") {
      return NextResponse.json({ error: "Staff photos must be captured as WebP." }, { status: 415, headers: noStore });
    }
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Staff photo must be 5 MB or smaller." }, { status: 413, headers: noStore });
    }

    const db = getSupabaseAdmin();
    const employee = await loadStaffEmployee(db, employeeId);
    if (!employee) {
      return NextResponse.json({ error: "Staff employee not found." }, { status: 404, headers: noStore });
    }
    const previousPath = employee.photo_path || null;
    const objectPath = `employees/${employeeId}/${Date.now()}-${randomUUID()}.webp`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const upload = await db.storage.from(PHOTO_BUCKET).upload(objectPath, bytes, {
      contentType: "image/webp",
      cacheControl: "60",
      upsert: false,
    });
    if (upload.error) throw upload.error;

    const updateResult = await db
      .from("bgm_staff_employees")
      .update({ photo_path: objectPath, updated_at: new Date().toISOString() })
      .eq("id", employeeId)
      .select("id, photo_path, home_gym_id")
      .maybeSingle();
    if (updateResult.error || !updateResult.data || updateResult.data.photo_path !== objectPath) {
      await db.storage.from(PHOTO_BUCKET).remove([objectPath]);
      throw updateResult.error || new Error("Photo uploaded but staff record was not updated.");
    }

    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.photo.updated",
        entityType: "staff_employee",
        entityId: employeeId,
        beforeData: { hasPhoto: Boolean(previousPath) },
        afterData: { hasPhoto: true },
        contextGymId: updateResult.data.home_gym_id,
      });
    } catch (error) {
      await db.from("bgm_staff_employees").update({
        photo_path: previousPath,
        updated_at: new Date().toISOString(),
      }).eq("id", employeeId);
      await db.storage.from(PHOTO_BUCKET).remove([objectPath]);
      throw error;
    }

    if (previousPath && previousPath !== objectPath) {
      const cleanup = await db.storage.from(PHOTO_BUCKET).remove([previousPath]);
      if (cleanup.error) console.error("Could not remove replaced staff photo", cleanup.error);
    }

    return NextResponse.json({
      ok: true,
      photoUrl: `/api/system/staff-employees/${encodeURIComponent(employeeId)}/photo?v=${Date.now()}`,
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save the staff photo." }, { status: 500, headers: noStore });
  }
}
