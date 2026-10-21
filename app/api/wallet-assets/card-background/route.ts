export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTWORK_URL =
  "https://jsuolemirhivqhjbjetv.supabase.co/storage/v1/object/public/wallet-assets/bgm-wallet-hero-v8.jpg";

async function loadArtwork() {
  const response = await fetch(ARTWORK_URL, { cache: "force-cache" });
  if (!response.ok) throw new Error("Membership artwork is unavailable.");
  return new Uint8Array(await response.arrayBuffer());
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
