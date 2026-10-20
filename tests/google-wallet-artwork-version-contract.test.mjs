import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("../lib/googleWalletServer.ts", import.meta.url));
const source = readFileSync(serverPath, "utf8");

test("Google Wallet forces a fresh fetch of every premium artwork asset", () => {
  assert.match(source, /const WALLET_ART_VERSION = "4"/);
  assert.match(source, /function walletArtworkUrl/);
  assert.match(source, /body\.logo[\s\S]*walletArtworkUrl\(config\.logoUrl/);
  assert.match(source, /body\.wideLogo[\s\S]*walletArtworkUrl\(config\.wideLogoUrl/);
  assert.match(source, /body\.heroImage[\s\S]*walletArtworkUrl\([\s\S]*config\.heroImageUrl/);
  assert.match(source, /searchParams\.set\("v", WALLET_ART_VERSION\)/);
});
