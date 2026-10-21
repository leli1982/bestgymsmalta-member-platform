import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_PATH = fileURLToPath(
  new URL("../../../../public/wallet/bgm-mark-white.svg", import.meta.url),
);

const BACKGROUNDS = {
  single: "#111111",
  student: "#166534",
  couples: "#B91C1C",
} as const;

type MembershipType = keyof typeof BACKGROUNDS;

function membershipType(request: Request): MembershipType {
  const value = new URL(request.url).searchParams.get("membership");
  return value === "student" || value === "couples" || value === "single"
    ? value
    : "single";
}

export async function GET(request: Request) {
  const logoData = await readFile(LOGO_PATH, "base64");
  const logoSrc = `data:image/svg+xml;base64,${logoData}`;
  const background = BACKGROUNDS[membershipType(request)];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        }}
      >
        <img
          src={logoSrc}
          alt=""
          width="900"
          height="900"
          style={{ width: 900, height: 900, objectFit: "contain" }}
        />
      </div>
    ),
    {
      width: 1024,
      height: 1024,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    },
  );
}
