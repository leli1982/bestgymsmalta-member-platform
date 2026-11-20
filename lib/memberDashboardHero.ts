import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const MEMBER_HERO_BUCKET = "bgm-announcements";
export const MEMBER_HERO_DEFAULT = "/visuals/home-hero-duo.jpg";
export const MEMBER_HERO_MAX_BYTES = 5 * 1024 * 1024;
export const MEMBER_HERO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const validPath = /^home-hero\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export function validMemberHeroImage(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mime === "image/webp") return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export function memberHeroPublicUrl(path: string | null): string | null {
  if (!path || !validPath.test(path)) return null;
  return getSupabaseAdmin().storage.from(MEMBER_HERO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function currentMemberHero() {
  const { data, error } = await getSupabaseAdmin()
    .from("bgm_member_dashboard_hero")
    .select("image_path, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    imageUrl: memberHeroPublicUrl(data?.image_path ?? null),
    updatedAt: data?.updated_at ?? null,
  };
}
