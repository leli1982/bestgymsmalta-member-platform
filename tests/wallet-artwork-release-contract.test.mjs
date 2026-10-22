import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const artworkUrl = new URL("../public/wallet/bgm-wallet-hero-v8.jpg", import.meta.url);
const artworkPath = fileURLToPath(artworkUrl);
const cardRoute = readFileSync(new URL("../app/api/wallet-assets/card-background/route.ts", import.meta.url), "utf8");
const heroRoute = readFileSync(new URL("../app/api/wallet-assets/hero/route.tsx", import.meta.url), "utf8");

function readJpegDimensions(path) {
  const data = readFileSync(path);
  assert.equal(data[0], 0xff, "Wallet v8 artwork must be a JPEG");
  assert.equal(data[1], 0xd8, "Wallet v8 artwork must be a JPEG");

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 1 >= data.length) break;

    const segmentLength = data.readUInt16BE(offset);
    if (sofMarkers.has(marker)) {
      return {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  throw new Error("Could not read Wallet v8 JPEG dimensions");
}

test("production Wallet artwork is bundled and high resolution", () => {
  assert.ok(existsSync(artworkPath), "approved Wallet v8 artwork must ship with the app");

  const { width, height } = readJpegDimensions(artworkPath);
  assert.ok(
    width >= 1000 && height >= 800,
    `Wallet v8 artwork must remain high resolution; got ${width}x${height}`,
  );
});

test("Wallet artwork routes use the bundled v8 asset rather than Supabase storage", () => {
  assert.match(cardRoute, /public\/wallet\/bgm-wallet-hero-v8\.jpg/);
  assert.match(heroRoute, /\/wallet\/bgm-wallet-hero-v8\.jpg/);

  for (const source of [cardRoute, heroRoute]) {
    assert.doesNotMatch(source, /supabase\.co\/storage/);
  }
});
