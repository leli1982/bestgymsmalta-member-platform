import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync(new URL("../components/member/MemberCard.tsx", import.meta.url), "utf8");

test("membership card has non-mirrored front and back surfaces on iPhone Safari", () => {
  assert.doesNotMatch(card, /rotateY\(|backfaceVisibility|preserve-3d|perspective:\s*["']/);
  assert.equal((card.match(/opacity:\s*flipped\s*\?\s*0\s*:\s*1/g) || []).length, 2);
  assert.equal((card.match(/opacity:\s*flipped\s*\?\s*1\s*:\s*0/g) || []).length, 2);

  // Simulate the original flip as two non-mirrored 2D halves:
  // outgoing face collapses first; incoming face expands after 300ms.
  assert.equal((card.match(/transition-\\[opacity,transform\\]/g) || []).length, 4);
  assert.equal((card.match(/duration-300/g) || []).length, 4);
  assert.equal((card.match(/transitionDelay:\\s*flipped\\s*\\?\\s*"0ms"\\s*:\\s*"300ms"/g) || []).length, 2);
  assert.equal((card.match(/transitionDelay:\\s*flipped\\s*\\?\\s*"300ms"\\s*:\\s*"0ms"/g) || []).length, 2);
  assert.equal((card.match(/transform:\\s*flipped\\s*\\?\\s*"scaleX\\(0\\)"\\s*:\\s*"scaleX\\(1\\)"/g) || []).length, 2);
  assert.equal((card.match(/transform:\\s*flipped\\s*\\?\\s*"scaleX\\(1\\)"\\s*:\\s*"scaleX\\(0\\)"/g) || []).length, 2);
  assert.match(card, /motion-reduce:transition-none/);

  assert.match(card, /aria-hidden=\{flipped\}/);
  assert.match(card, /aria-hidden=\{!flipped\}/);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{assignedCardNumber\}/);
  assert.match(card, /setFlipped\(\(value\) => !value\)/);
});
