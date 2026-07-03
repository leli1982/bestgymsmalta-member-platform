import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const BUCKET = "bgm-progress-photos";

function clean(value: unknown) {
  return String(value || "").trim();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

async function getActiveMember(memberId: string) {
  const supabase = getSupabaseAdmin();

  const result = await supabase
    .from("bgm_members")
    .select("id, status, membership_expiry")
    .eq("id", memberId)
    .maybeSingle();

  if (result.error) throw result.error;

  const member = result.data;

  if (!member) {
    return { ok: false, error: "Member account not found." };
  }

  if (member.status !== "active") {
    return {
      ok: false,
      error: "This membership is inactive. Please renew at reception.",
    };
  }

  if (member.membership_expiry && member.membership_expiry < todayString()) {
    return {
      ok: false,
      error: "This membership has expired. Please renew at reception.",
    };
  }

  return { ok: true, error: "" };
}

async function signedUrlForPath(path: string) {
  const supabase = getSupabaseAdmin();

  const result = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (result.error) return "";

  return result.data.signedUrl;
}

async function publicPhoto(row: any) {
  const signedUrl = await signedUrlForPath(row.photo_path);

  return {
    id: row.id,
    memberId: row.member_id,
    photoPath: row.photo_path,
    imageUrl: signedUrl || row.photo_url || "",
    progressDate: row.progress_date,
    bodyWeight: row.body_weight || "",
    photoView: row.photo_view || "front",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const memberId = clean(request.nextUrl.searchParams.get("memberId"));

    if (!memberId) {
      return NextResponse.json({ photos: [] });
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("bgm_progress_photos")
      .select("*")
      .eq("member_id", memberId)
      .order("progress_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;

    const photos = await Promise.all((result.data || []).map(publicPhoto));

    return NextResponse.json({ photos });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { photos: [], error: "Could not load progress photos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const memberId = clean(formData.get("memberId"));
    const progressDate = clean(formData.get("progressDate")) || todayString();
    const bodyWeight = clean(formData.get("bodyWeight"));
    const photoView = clean(formData.get("photoView")) || "front";
    const notes = clean(formData.get("notes"));
    const file = formData.get("photo");

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in before uploading progress photos." },
        { status: 401 }
      );
    }

    const activeMember = await getActiveMember(memberId);

    if (!activeMember.ok) {
      return NextResponse.json(
        { error: activeMember.error },
        { status: 403 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please choose a photo to upload." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const fileName = safeFileName(`${Date.now()}-${photoView}.${fileExt}`);
    const photoPath = `${memberId}/${fileName}`;

    const uploadResult = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) throw uploadResult.error;

    const insertResult = await supabase
      .from("bgm_progress_photos")
      .insert({
        member_id: memberId,
        photo_path: photoPath,
        progress_date: progressDate,
        body_weight: bodyWeight || null,
        photo_view: photoView,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertResult.error) throw insertResult.error;

    return NextResponse.json({
      photo: await publicPhoto(insertResult.data),
      message: "Progress photo saved.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not upload progress photo." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const memberId = clean(request.nextUrl.searchParams.get("memberId"));
    const photoId = clean(request.nextUrl.searchParams.get("photoId"));

    if (!memberId || !photoId) {
      return NextResponse.json(
        { error: "Missing member or photo ID." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const existingResult = await supabase
      .from("bgm_progress_photos")
      .select("*")
      .eq("id", photoId)
      .eq("member_id", memberId)
      .maybeSingle();

    if (existingResult.error) throw existingResult.error;

    if (!existingResult.data) {
      return NextResponse.json(
        { error: "Progress photo not found." },
        { status: 404 }
      );
    }

    await supabase.storage.from(BUCKET).remove([existingResult.data.photo_path]);

    const deleteResult = await supabase
      .from("bgm_progress_photos")
      .delete()
      .eq("id", photoId)
      .eq("member_id", memberId);

    if (deleteResult.error) throw deleteResult.error;

    return NextResponse.json({
      ok: true,
      message: "Progress photo deleted.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not delete progress photo." },
      { status: 500 }
    );
  }
}
