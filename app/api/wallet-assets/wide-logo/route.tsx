import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";

const LOGO_PATH = fileURLToPath(
  new URL("../../../../public/wallet/bgm-logo-white.png", import.meta.url),
);

export async function GET() {
  const logoData = await readFile(LOGO_PATH, "base64");
  const logoSrc = `data:image/png;base64,${logoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <img
          src={logoSrc}
          alt=""
          width="1900"
          height="210"
          style={{ width: 1900, height: 210, objectFit: "contain" }}
        />
      </div>
    ),
    {
      width: 2000,
      height: 440,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    },
  );
}
