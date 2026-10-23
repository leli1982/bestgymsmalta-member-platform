export const dynamic = "force-dynamic";

const BUNDLED_ARTWORK = "/wallet/bgm-wallet-hero-regular-v11.jpg?v=12";

export async function GET(request: Request) {
  try {
    const upstream = await fetch(new URL(BUNDLED_ARTWORK, request.url), {
      cache: "force-cache",
    });
    if (!upstream.ok) throw new Error(`Artwork fetch failed: ${upstream.status}`);

    return new Response(await upstream.arrayBuffer(), {
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
