import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";

const LOGO_PATH = fileURLToPath(
  new URL("../../../../../public/wallet/bgm-logo-white.png", import.meta.url),
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
          position: "relative",
          overflow: "hidden",
          background: "transparent",
          color: "white",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 52,
            top: 58,
            display: "flex",
            flexDirection: "column",
            fontSize: 54,
            lineHeight: 1.02,
            fontWeight: 700,
            letterSpacing: -1.5,
          }}
        >
          <span>Be the best,</span>
          <span>beat the rest</span>
        </div>

        <div
          style={{
            position: "absolute",
            right: -55,
            top: -80,
            width: 420,
            height: 420,
            display: "flex",
            overflow: "hidden",
            opacity: 0.16,
          }}
        >
          <img
            src={logoSrc}
            alt=""
            width="2036"
            height="420"
            style={{ width: 2036, height: 420, maxWidth: "none", flexShrink: 0 }}
          />
        </div>
      </div>
    ),
    {
      width: 1032,
      height: 336,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    },
  );
}
