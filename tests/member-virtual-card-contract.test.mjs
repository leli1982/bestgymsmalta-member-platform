import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const routePath = join(root, "app/api/member/card/route.ts");
const cardPath = join(root, "components/member/MemberCard.tsx");
const pagePath = join(root, "app/card/page.tsx");

test("member card API returns the active physical card for scanning and retains friendly BGM number", () => {
  assert.equal(existsSync(routePath), true, "member card API route must exist");
  const route = readFileSync(routePath, "utf8");
  assert.match(route, /getMemberRequestSession\(request\)/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /status/);
  assert.match(route, /active/);
  assert.match(route, /barcode_value/);
  assert.match(route, /member_number/);
  assert.match(route, /cardBarcode:\s*activeCredential\?\.barcode_value \|\| null/);
  assert.match(route, /physicalCardBarcode/);
  assert.match(route, /cardLinked/);
  assert.match(route, /source: activeCredential \? "physical_card" : null/);
  assert.doesNotMatch(route, /searchParams|get\(["']memberId["']\)/);
});

test("digital member card scans current physical card and shows friendly BGM number separately", () => {
  const card = readFileSync(cardPath, "utf8");
  assert.match(card, /fetch\(["']\/api\/member\/card["']/);
  assert.match(card, /cache:\s*["']no-store["']/);
  assert.match(card, /cardBarcode/);
  assert.match(card, /cardLinked/);
  assert.match(card, /physicalCardBarcode/);
  assert.match(card, /BGM member number/i);
  assert.match(card, /Current card number/i);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{assignedCardNumber\}/);
  assert.match(card, /member\.memberNumber/);
  assert.match(card, /Card not assigned/);
  assert.doesNotMatch(card, /<MemberBarcode\s+memberNumber=\{member\.memberNumber\}/);
});

test("membership card copy explains that the friendly number is distinct from the current scannable card", () => {
  const page = readFileSync(pagePath, "utf8");
  assert.match(page, /BGM membership number/i);
  assert.match(page, /physical card/i);
  assert.match(page, /digital barcode uses your current physical card number/i);
  assert.doesNotMatch(page, /NFC-ready membership access is\s+prepared for future rollout/i);
});
