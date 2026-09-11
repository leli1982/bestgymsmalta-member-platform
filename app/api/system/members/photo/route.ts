import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const PHOTO_BUCKET = "bgm-member-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function clean(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function objectStamp() {
  return `${Date.now()}-${randomUUID()}`;
}

async function signedApplicationPhoto(request: NextRequest) {
  const auth = await requireSystemPermission(request, "members.photos.view");
  if (auth.error || !auth.context) return auth.error;

  const applicationMemberId = clean(
    request.nextUrl.searchParams.get("applicationMemberId")
  );
  if (!applicationMemberId) {
    return NextResponse.json({ error: "Application participant is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const participantResult = await supabase
    .from("bgm_membership_application_members")
    .select("id, application_id, official_photo_path")
    .eq("id", applicationMemberId)
    .maybeSingle();
  if (participantResult.error) throw participantResult.error;
  if (!participantResult.data) {
    return NextResponse.json({ error: "Application participant not found." }, { status: 404 });
  }

  const applicationResult = await supabase
    .from("bgm_membership_applications")
    .select("id, enrollment_gym_id")
    .eq("id", participantResult.data.application_id)
    .maybeSingle();
  if (applicationResult.error) throw applicationResult.error;
  if (!applicationResult.data) {
    return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
  }

  if (
    !auth.context.isSuperAdmin &&
    auth.context.gymId !== applicationResult.data.enrollment_gym_id
  ) {
    return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
  }

  const objectPath = participantResult.data.official_photo_path;
  if (!objectPath) {
    return NextResponse.json({ error: "No official photo has been captured." }, { status: 404 });
  }

  const signed = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(objectPath, 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error || new Error("Could not sign official photo.");
  }

  return NextResponse.redirect(signed.data.signedUrl, 307);
}

export async function GET(request: NextRequest) {
  try {
    return await signedApplicationPhoto(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load official photo." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.photos.capture");
    if (auth.error || !auth.context) return auth.error;

    const formData = await request.formData();
    const applicationMemberId = clean(formData.get("applicationMemberId"));
    const memberId = clean(formData.get("memberId"));
    const staffName = clean(formData.get("staffName")) || null;
    const requestedSource = clean(formData.get("source"));
    const file = formData.get("file");

    if (Boolean(applicationMemberId) === Boolean(memberId)) {
      return NextResponse.json(
        { error: "Provide exactly one photo target." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Official photo file is required." }, { status: 400 });
    }
    if (file.type !== "image/webp") {
      return NextResponse.json({ error: "Official photos must be captured as WebP." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Official photo must be 5 MB or smaller." }, { status: 413 });
    }

    const supabase = getSupabaseAdmin();
    let source: "new_membership" | "renewal" | "reception_capture";
    let gymId: string | null = auth.context.gymId;
    let objectPath: string;
    let previousPath: string | null = null;
    let applicationId: string | null = null;

    if (applicationMemberId) {
      const participantResult = await supabase
        .from("bgm_membership_application_members")
        .select("id, application_id, official_photo_path")
        .eq("id", applicationMemberId)
        .maybeSingle();
      if (participantResult.error) throw participantResult.error;
      if (!participantResult.data) {
        return NextResponse.json({ error: "Application participant not found." }, { status: 404 });
      }

      applicationId = participantResult.data.application_id;
      previousPath = participantResult.data.official_photo_path || null;
      const applicationResult = await supabase
        .from("bgm_membership_applications")
        .select("id, application_kind, enrollment_gym_id, staff_name, status")
        .eq("id", applicationId)
        .maybeSingle();
      if (applicationResult.error) throw applicationResult.error;
      if (!applicationResult.data) {
        return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
      }
      if (!["submitted", "awaiting_payment"].includes(applicationResult.data.status)) {
        return NextResponse.json({ error: "This application is no longer awaiting activation." }, { status: 409 });
      }
      if (
        !auth.context.isSuperAdmin &&
        auth.context.gymId !== applicationResult.data.enrollment_gym_id
      ) {
        return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
      }

      gymId = applicationResult.data.enrollment_gym_id;
      source = applicationResult.data.application_kind === "renewal" ? "renewal" : "new_membership";
      objectPath = `applications/${applicationId}/${applicationMemberId}/${objectStamp()}.webp`;
    } else {
      const memberResult = await supabase
        .from("bgm_members")
        .select("id, official_photo_path")
        .eq("id", memberId)
        .maybeSingle();
      if (memberResult.error) throw memberResult.error;
      if (!memberResult.data) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      previousPath = memberResult.data.official_photo_path || null;
      source = requestedSource === "renewal" ? "renewal" : "reception_capture";
      objectPath = `${memberId}/official/${objectStamp()}.webp`;
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const upload = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(objectPath, bytes, {
        contentType: "image/webp",
        cacheControl: "60",
        upsert: false,
      });
    if (upload.error) throw upload.error;

    const targetTable = applicationMemberId
      ? "bgm_membership_application_members"
      : "bgm_members";
    const targetId = applicationMemberId || memberId;
    const updateResult = await supabase
      .from(targetTable)
      .update({ official_photo_path: objectPath, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    if (updateResult.error) {
      await supabase.storage.from(PHOTO_BUCKET).remove([objectPath]);
      throw updateResult.error;
    }

    const provenanceResult = await supabase.from("bgm_member_official_photos").insert({
      member_id: memberId || null,
      application_member_id: applicationMemberId || null,
      object_path: objectPath,
      source,
      system_user_id: auth.context.systemUserId,
      gym_id: gymId,
      staff_name: staffName,
    });

    if (provenanceResult.error) {
      await supabase
        .from(targetTable)
        .update({ official_photo_path: previousPath, updated_at: new Date().toISOString() })
        .eq("id", targetId);
      await supabase.storage.from(PHOTO_BUCKET).remove([objectPath]);
      throw provenanceResult.error;
    }

    return NextResponse.json({
      ok: true,
      captured: true,
      photoUrl: memberId
        ? `/api/system/members/photo/${memberId}`
        : `/api/system/members/photo?applicationMemberId=${encodeURIComponent(applicationMemberId)}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save official member photo." }, { status: 500 });
  }
}
