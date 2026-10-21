import { Buffer } from "node:buffer";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTWORK_URL =
  "https://jsuolemirhivqhjbjetv.supabase.co/storage/v1/object/public/wallet-assets/bgm-wallet-hero-v8.jpg";

const THEMES = {
  single: { color: "#111111", opacity: 0.58 },
  student: { color: "#166534", opacity: 0.24 },
  couples: { color: "#B91C1C", opacity: 0.46 },
} as const;

type MembershipType = keyof typeof THEMES;

function membershipType(request: Request): MembershipType {
  const value = new URL(request.url).searchParams.get("membership");
  return value === "student" || value === "couples" || value === "single"
    ? value
    : "single";
}

async function artworkDataUri() {
  const response = await fetch(ARTWORK_URL, { cache: "force-cache" });
  if (!response.ok) throw new Error("Membership artwork is unavailable.");
  const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:image/jpeg;base64,${bytes}`;
}

export async function GET(request: Request) {
  try {
    const imageSrc = await artworkDataUri();
    const theme = THEMES[membershipType(request)];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            overflow: "hidden",
            background: theme.color,
          }}
        >
          <img
            src={imageSrc}
            alt=""
            width="1032"
            height="812"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              background: theme.color,
              opacity: theme.opacity,
            }}
          />
        </div>
      ),
      {
        width: 1032,
        height: 812,
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
        },
      },
    );
  } catch {
    return new Response("Membership artwork is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
