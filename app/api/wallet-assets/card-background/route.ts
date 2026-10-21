import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "wallet-assets";
const ARTWORK = "bgm-wallet-hero-v8.jpg";

async function loadArtwork() {
  const supabase = getSupabaseAdmin();
  const result = await supabase.storage.from(BUCKET).download(ARTWORK);
  if (result.error || !result.data) throw new Error("Membership artwork is unavailable.");
  return result.data;
}

export async function GET() {
  try {
    const artwork = await loadArtwork();
    return new Response(artwork, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("Membership artwork is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
