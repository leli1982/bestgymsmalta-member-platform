import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const memberCard = await readFile(new URL("../components/member/MemberCard.tsx", import.meta.url), "utf8");
const walletServer = await readFile(new URL("../lib/googleWalletServer.ts", import.meta.url), "utf8");
const listLogoRoute = await readFile(new URL("../app/api/wallet-assets/list-logo/route.tsx", import.meta.url), "utf8");
const wideLogoRoute = await readFile(new URL("../app/api/wallet-assets/wide-logo/route.tsx", import.meta.url), "utf8");
const heroRoute = await readFile(new URL("../app/api/wallet-assets/hero/route.tsx", import.meta.url), "utf8");
const cardBackgroundRoute = await readFile(new URL("../app/api/wallet-assets/card-background/route.tsx", import.meta.url), "utf8");

test("Google Wallet list artwork follows the membership colour", () => {
  assert.match(walletServer, /walletArtworkUrl\(config\.logoUrl, projection\.theme\.type\)/);
  assert.match(listLogoRoute, /searchParams\.get\("membership"\)/);
  assert.match(listLogoRoute, /#111111/);
  assert.match(listLogoRoute, /#166534/);
  assert.match(listLogoRoute, /#B91C1C/);
  assert.match(listLogoRoute, /width:\s*1024/);
  assert.match(listLogoRoute, /height:\s*1024/);
});

test("BGM logo artwork is rendered at higher pixel density", () => {
  assert.match(wideLogoRoute, /width:\s*2000/);
  assert.match(wideLogoRoute, /height:\s*440/);
  assert.match(memberCard, /w-64/);
});

test("approved membership artwork is rendered at higher pixel density", () => {
  assert.match(memberCard, /\/api\/wallet-assets\/card-background\?v=2/);
  assert.match(cardBackgroundRoute, /width:\s*2064/);
  assert.match(cardBackgroundRoute, /height:\s*1624/);
  assert.match(heroRoute, /width:\s*2064/);
  assert.match(heroRoute, /height:\s*1624/);
  assert.match(walletServer, /WALLET_ART_VERSION = "6"/);
});
