import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const memberCard = readFileSync("components/member/MemberCard.tsx", "utf8");
const heroRoute = readFileSync("app/api/wallet-assets/hero/route.tsx", "utf8");
const walletServer = readFileSync("lib/googleWalletServer.ts", "utf8");

test("in-app card preserves the approved master artwork instead of portrait-cropping it", () => {
  assert.match(memberCard, /bgm-wallet-master-bg\.jpg/);
  assert.match(memberCard, /object-contain object-top/);
  assert.doesNotMatch(memberCard, /object-cover object-center/);
  assert.doesNotMatch(memberCard, /-right-16 -top-20/);
  assert.doesNotMatch(memberCard, /-right-8 -top-10/);
  assert.doesNotMatch(memberCard, /\$\{themeColor\}F2/);
});

test("wallet hero keeps the approved artwork visible under a light membership tint", () => {
  assert.match(heroRoute, /single:\s*\{\s*color:\s*"#111111",\s*opacity:\s*0\.18/);
  assert.match(heroRoute, /student:\s*\{\s*color:\s*"#166534",\s*opacity:\s*0\.28/);
  assert.match(heroRoute, /couples:\s*\{\s*color:\s*"#B91C1C",\s*opacity:\s*0\.28/);
});

test("wallet artwork cache version is bumped after approved-artwork change", () => {
  assert.match(walletServer, /WALLET_ART_VERSION = "5"/);
});
