import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const routePath = join(root, "app/api/member/card/route.ts");
const cardPath = join(root, "components/member/MemberCard.tsx");
const pagePath = join(root, "app/card/page.tsx");

test("member card API returns the permanent BGM virtual barcode and keeps physical card separate", () => {
  assert.equal(existsSync(routePath), true, "member card API route must exist");
  const route = readFileSync(routePath, "utf8");
  assert.match(route, /getMemberRequestSession\(request\)/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /status/);
  assert.match(route, /active/);
  assert.match(route, /barcode_value/);
  assert.match(route, /member_number/);
  assert.match(route, /cardBarcode:\s*memberNumber/);
  assert.match(route, /physicalCardBarcode/);
  assert.match(route, /cardLinked/);
  assert.match(route, /source:\s*["']member_number["']/);
  assert.doesNotMatch(route, /searchParams|get\(["']memberId["']\)/);
});

test("digital member card renders the permanent BGM barcode and shows physical card separately", () => {
  const card = readFileSync(cardPath, "utf8");
  assert.match(card, /fetch\(["']\/api\/member\/card["']/);
  assert.match(card, /cache:\s*["']no-store["']/);
  assert.match(card, /cardBarcode/);
  assert.match(card, /cardLinked/);
  assert.match(card, /physicalCardBarcode/);
  assert.match(card, /BGM member number/i);
  assert.match(card, /Physical card/i);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{cardBarcode\}/);
  assert.doesNotMatch(card, /<MemberBarcode\s+memberNumber=\{physicalCardBarcode\}/);
});

test("membership card copy explains that virtual and physical barcodes are different identifiers", () => {
  const page = readFileSync(pagePath, "utf8");
  assert.match(page, /permanent BGM member number/i);
  assert.match(page, /physical card/i);
  assert.match(page, /both identify the same membership/i);
  assert.doesNotMatch(page, /NFC-ready membership access is\s+prepared for future rollout/i);
});
