import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const BUCKET_NAME = "bgm-gym-logos";

function isAdmin(request: NextRequest) {
  return requireAdmin(request) === null;
}

function safeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "png";
  const cleanedName = name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${cleanedName || "gym-logo"}-${Date.now()}.${extension}`;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No logo uploaded." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Logo is too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const fileName = safeFileName(file.name);

    const uploadResult = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadResult.error) throw uploadResult.error;

    const publicUrlResult = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return NextResponse.json({
      logoUrl: publicUrlResult.data.publicUrl,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Logo upload failed." },
      { status: 500 }
    );
  }
}
