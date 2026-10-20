import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MASTER_PATH = fileURLToPath(
  new URL("../../../../public/wallet/bgm-wallet-master-bg.jpg", import.meta.url),
);

const OVERLAYS = {
  single: { color: "#111111", opacity: 0.42 },
  student: { color: "#166534", opacity: 0.5 },
  couples: { color: "#B91C1C", opacity: 0.5 },
} as const;

type MembershipType = keyof typeof OVERLAYS;

function membershipType(request: Request): MembershipType {
  const value = new URL(request.url).searchParams.get("membership");
  return value === "student" || value === "couples" || value === "single"
    ? value
    : "single";
}

export async function GET(request: Request) {
  const imageData = await readFile(MASTER_PATH, "base64");
  const imageSrc = `data:image/jpeg;base64,${imageData}`;
  const overlay = OVERLAYS[membershipType(request)];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#111111",
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
            background: overlay.color,
            opacity: overlay.opacity,
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
}
