import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTWORK_PATH = fileURLToPath(
  new URL("../../../../public/wallet/bgm-wallet-hero-v8.jpg", import.meta.url),
);

async function loadArtwork() {
  return new Uint8Array(await readFile(ARTWORK_PATH));
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
