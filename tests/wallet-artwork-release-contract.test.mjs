import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const artworkFiles = {
  regular: new URL("../public/wallet/bgm-wallet-hero-regular-v11.jpg", import.meta.url),
  student: new URL("../public/wallet/bgm-wallet-hero-student-v11.jpg", import.meta.url),
  couples: new URL("../public/wallet/bgm-wallet-hero-couples-v11.jpg", import.meta.url),
};
const cardRoute = readFileSync(new URL("../app/api/wallet-assets/card-background/route.ts", import.meta.url), "utf8");
const heroRoute = readFileSync(new URL("../app/api/wallet-assets/hero/route.tsx", import.meta.url), "utf8");
const memberCard = readFileSync(new URL("../components/member/MemberCard.tsx", import.meta.url), "utf8");

function readJpegDimensions(path) {
  const data = readFileSync(path);
  assert.equal(data[0], 0xff, "Wallet artwork must be a JPEG");
  assert.equal(data[1], 0xd8, "Wallet artwork must be a JPEG");

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  for (let offset = 2; offset + 9 < data.length; offset += 1) {
    if (data[offset] !== 0xff) continue;
    let markerOffset = offset + 1;
    while (markerOffset < data.length && data[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= data.length) break;
    const marker = data[markerOffset];
    if (marker === 0xda) break;
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
    ) return { width, height };
  }

  throw new Error("Could not read Wallet JPEG dimensions");
}

test("approved Regular, Student and Couples Wallet artwork is bundled and high resolution", () => {
  for (const [membership, url] of Object.entries(artworkFiles)) {
    const path = fileURLToPath(url);
    assert.ok(existsSync(path), `${membership} Wallet artwork must ship with the app`);
    const { width, height } = readJpegDimensions(path);
    assert.ok(
      width >= 1000 && height >= 800,
      `${membership} Wallet artwork must remain high resolution; got ${width}x${height}`,
    );
  }
});

test("Member Card maps the three approved artwork variants without grayscale filtering", () => {
  assert.match(memberCard, /bgm-wallet-hero-regular-v11\.jpg/);
  assert.match(memberCard, /bgm-wallet-hero-student-v11\.jpg/);
  assert.match(memberCard, /bgm-wallet-hero-couples-v11\.jpg/);
  assert.doesNotMatch(memberCard, /grayscale\(/);
});

test("Wallet artwork routes return bundled image bytes and never use the broken legacy asset", () => {
  assert.match(cardRoute, /bgm-wallet-hero-regular-v11\.jpg/);
  assert.match(heroRoute, /bgm-wallet-hero-regular-v11\.jpg/);
  assert.match(heroRoute, /bgm-wallet-hero-student-v11\.jpg/);
  assert.match(heroRoute, /bgm-wallet-hero-couples-v11\.jpg/);

  for (const source of [cardRoute, heroRoute]) {
    assert.doesNotMatch(source, /Response\.redirect/);
    assert.doesNotMatch(source, /bgm-wallet-hero-v8\.jpg/);
    assert.doesNotMatch(source, /supabase\.co\/storage/);
  }
});
