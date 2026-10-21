import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";

const MASTER_PATH = fileURLToPath(
  new URL("../../../../public/wallet/bgm-wallet-master-bg.jpg", import.meta.url),
);

export async function GET() {
  const imageData = await readFile(MASTER_PATH, "base64");
  const imageSrc = `data:image/jpeg;base64,${imageData}`;

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
          width="2064"
          height="1624"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>
    ),
    {
      width: 2064,
      height: 1624,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    },
  );
}
