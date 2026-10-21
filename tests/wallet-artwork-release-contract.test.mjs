import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const artworkUrl = new URL("../public/wallet/bgm-wallet-hero-v8.jpg", import.meta.url);
const artworkPath = fileURLToPath(artworkUrl);
const cardRoute = readFileSync(new URL("../app/api/wallet-assets/card-background/route.ts", import.meta.url), "utf8");
const heroRoute = readFileSync(new URL("../app/api/wallet-assets/hero/route.tsx", import.meta.url), "utf8");

test("production Wallet artwork is bundled and high resolution", () => {
  assert.ok(existsSync(artworkPath), "approved Wallet v8 artwork must ship with the app");
  assert.ok(statSync(artworkPath).size > 50_000, "Wallet v8 artwork must not regress to the compressed low-resolution asset");
});

test("Wallet artwork routes use the bundled v8 asset rather than Supabase storage", () => {
  assert.match(cardRoute, /public\/wallet\/bgm-wallet-hero-v8\.jpg/);
  assert.match(heroRoute, /\/wallet\/bgm-wallet-hero-v8\.jpg/);

  for (const source of [cardRoute, heroRoute]) {
    assert.doesNotMatch(source, /supabase\.co\/storage/);
  }
});
