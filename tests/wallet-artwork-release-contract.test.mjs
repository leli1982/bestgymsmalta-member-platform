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

  // Scan for the JPEG Start Of Frame marker directly instead of walking
  // preceding metadata by declared segment lengths. Some valid JPEG encoders
  // emit metadata layouts that make that style of parser unnecessarily brittle.
  for (let offset = 2; offset + 9 < data.length; offset += 1) {
    if (data[offset] !== 0xff) continue;

    let markerOffset = offset + 1;
    while (markerOffset < data.length && data[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= data.length) break;

    const marker = data[markerOffset];
    if (marker === 0xda) break; // Start Of Scan: do not inspect compressed image bytes.
    if (!sofMarkers.has(marker)) continue;

    const lengthOffset = markerOffset + 1;
    if (lengthOffset + 7 >= data.length) continue;

    const segmentLength = data.readUInt16BE(lengthOffset);
    const precision = data[lengthOffset + 2];
    const height = data.readUInt16BE(lengthOffset + 3);
    const width = data.readUInt16BE(lengthOffset + 5);
    const components = data[lengthOffset + 7];

    if (
      segmentLength === 8 + (3 * components)
      && (precision === 8 || precision === 12)
      && width > 0
      && height > 0
    ) {
      return { width, height };
    }
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
