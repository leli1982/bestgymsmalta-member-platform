import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

const sourcePath = join(
  process.cwd(),
  "public",
  "visuals",
  "home-hero-duo-crisp.base64"
);

export async function GET() {
  const encoded = readFileSync(sourcePath, "utf8").replace(/\s+/g, "");
  const imageBuffer = Buffer.from(encoded, "base64");

  if (imageBuffer.byteLength < 20_000) {
    return new Response("Hero artwork is incomplete", { status: 500 });
  }

  return new Response(new Uint8Array(imageBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(imageBuffer.byteLength),
    },
  });
}
