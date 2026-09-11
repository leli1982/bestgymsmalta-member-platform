import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const routePath = join(root, "app/api/member/card/route.ts");
const cardPath = join(root, "components/member/MemberCard.tsx");
const pagePath = join(root, "app/card/page.tsx");

test("member card API resolves the signed-in member's current active physical-card credential", () => {
  assert.equal(existsSync(routePath), true, "member card API route must exist");
  const route = readFileSync(routePath, "utf8");
  assert.match(route, /getMemberRequestSession\(request\)/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /status/);
  assert.match(route, /active/);
  assert.match(route, /barcode_value/);
  assert.match(route, /member_number/);
  assert.match(route, /credentialRows\.length === 0/);
  assert.match(route, /cardBarcode/);
  assert.match(route, /cardLinked/);
  assert.doesNotMatch(route, /searchParams|get\(["']memberId["']\)/);
});

test("digital member card refreshes its barcode from the server and never relies on stale local memberNumber", () => {
  const card = readFileSync(cardPath, "utf8");
  assert.match(card, /fetch\(["']\/api\/member\/card["']/);
  assert.match(card, /cache:\s*["']no-store["']/);
  assert.match(card, /cardBarcode/);
  assert.match(card, /cardLinked/);
  assert.match(card, /CARD NOT LINKED/);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{cardBarcode\}/);
  assert.doesNotMatch(card, /<MemberBarcode\s+memberNumber=\{member\.memberNumber\}/);
});

test("membership card copy describes the virtual barcode as a mirror of the current physical card", () => {
  const page = readFileSync(pagePath, "utf8");
  assert.match(page, /physical BGM card/i);
  assert.match(page, /same barcode/i);
  assert.doesNotMatch(page, /NFC-ready membership access is\s+prepared for future rollout/i);
});
