import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cardPath = fileURLToPath(new URL("../components/member/MemberCard.tsx", import.meta.url));
const source = readFileSync(cardPath, "utf8");

test("member card uses the premium BGM artwork and approved brand treatment", () => {
  assert.match(source, /\/wallet\/bgm-wallet-master-bg\.jpg/);
  assert.match(source, /\/wallet\/bgm-logo-white\.png/);
  assert.match(source, /Be the best, beat the rest/);
  assert.match(source, /premiumCardOverlay/);
  assert.match(source, /theme\.background/);
  assert.match(source, /Membership type/);
  assert.match(source, /Valid until/);
  assert.match(source, /MemberBarcode/);
});
