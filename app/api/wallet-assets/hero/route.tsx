import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const theme = THEMES[membershipType(request)];
  const imageSrc = new URL("/wallet/bgm-wallet-hero-v8.jpg", request.url).toString();

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
        "Access-Control-Allow-Origin": "*",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
