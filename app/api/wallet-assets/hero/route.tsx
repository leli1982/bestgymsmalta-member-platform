export const dynamic = "force-dynamic";

type MembershipType = "single" | "student" | "couples";

const ARTWORK: Record<MembershipType, string> = {
  single: "/wallet/bgm-wallet-hero-regular-v11.jpg?v=12",
  student: "/wallet/bgm-wallet-hero-student-v11.jpg?v=12",
  couples: "/wallet/bgm-wallet-hero-couples-v11.jpg?v=12",
};

function membershipType(request: Request): MembershipType {
  const value = new URL(request.url).searchParams.get("membership")?.toLowerCase() ?? "";
  if (value.includes("student")) return "student";
  if (value.includes("couple")) return "couples";
  return "single";
}

export async function GET(request: Request) {
  try {
    const upstream = await fetch(new URL(ARTWORK[membershipType(request)], request.url), {
      cache: "force-cache",
    });
    if (!upstream.ok) throw new Error(`Artwork fetch failed: ${upstream.status}`);

    return new Response(await upstream.arrayBuffer(), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
        "Access-Control-Allow-Origin": "*",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[wallet-assets] unable to serve membership hero", error);
    return new Response("Membership artwork is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
