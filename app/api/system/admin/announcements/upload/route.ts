import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};
export async function POST(request: NextRequest) {
  const user = await getSystemContext(request);
  if (!user?.isSuperAdmin)
    return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !extensions[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "Choose a JPG, PNG or WebP image up to 5 MB." }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const path = `news/${randomUUID()}.${extensions[file.type]}`;
    const result = await supabase.storage.from("bgm-announcements").upload(path, file, {
      contentType: file.type, cacheControl: "3600", upsert: false,
    });
    if (result.error) throw result.error;
    const url = supabase.storage.from("bgm-announcements").getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ imageUrl: url });
  } catch (error) {
    console.error("Announcement image upload failed", error);
    return NextResponse.json({ error: "Could not upload image." }, { status: 500 });
  }
}
