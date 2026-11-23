import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync(new URL("../components/member/MemberCard.tsx", import.meta.url), "utf8");

test("membership card has non-mirrored front and back surfaces on iPhone Safari", () => {
  assert.doesNotMatch(card, /rotateY\(|backfaceVisibility|preserve-3d|perspective:\s*["']/);
  assert.equal((card.match(/opacity:\s*flipped\s*\?\s*0\s*:\s*1/g) || []).length, 2);
  assert.equal((card.match(/opacity:\s*flipped\s*\?\s*1\s*:\s*0/g) || []).length, 2);
  assert.match(card, /aria-hidden=\{flipped\}/);
  assert.match(card, /aria-hidden=\{!flipped\}/);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{assignedCardNumber\}/);
  assert.match(card, /setFlipped\(\(value\) => !value\)/);
});
