import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cardUrl = new URL("../components/movements/MovementCard.tsx", import.meta.url);
const detailUrl = new URL("../components/movements/MovementDetail.tsx", import.meta.url);

assert.ok(existsSync(fileURLToPath(cardUrl)), "MovementCard must exist");
assert.ok(existsSync(fileURLToPath(detailUrl)), "MovementDetail must exist");

const card = readFileSync(fileURLToPath(cardUrl), "utf8");
const detail = readFileSync(fileURLToPath(detailUrl), "utf8");

test("MovementCard accepts nullable enrichment and preserves plan-specific programming", () => {
  assert.match(card, /movement:\s*MovementDefinition\s*\|\s*null/);
  assert.match(card, /sets\?:\s*string/);
  assert.match(card, /reps\?:\s*string/);
  assert.match(card, /duration\?:\s*string/);
  assert.match(card, /rest\?:\s*string/);
  assert.match(card, /notes\?:\s*string/);
  assert.match(card, /programming\?:\s*MovementProgramming/);
  assert.match(card, /name:\s*string/);
});

test("MovementCard uses the shared light BGM surface and supports visual assets without inline human placeholders", () => {
  assert.match(card, /border-zinc-200/);
  assert.match(card, /bg-white/);
  assert.match(card, /text-zinc-950/);
  assert.match(card, /#ff5a0a/);
  assert.match(card, /diagramAsset/);
  assert.match(card, /alt=/);
  assert.match(card, /Visual guide coming soon/);
  assert.doesNotMatch(card, /<svg[^>]*>[\s\S]*?(?:circle|line|path)[\s\S]*?<\/svg>/i);
});

test("unknown movements retain their original name, programming and notes instead of disappearing", () => {
  assert.match(card, /\{name\}/);
  assert.match(card, /programming\.sets/);
  assert.match(card, /programming\.reps/);
  assert.match(card, /programming\.duration/);
  assert.match(card, /programming\.rest/);
  assert.match(card, /programming\.notes/);
  assert.match(card, /movement\s*\?/);
});

test("enriched movements expose an accessible technique control without hover-only interaction", () => {
  assert.match(card, /aria-expanded/);
  assert.match(card, /type=["']button["']/);
  assert.match(card, /MovementDetail/);
  assert.doesNotMatch(card, /onMouseEnter|onMouseLeave/);
});

test("MovementDetail contains the full technique and safety sections", () => {
  for (const field of [
    "startPosition",
    "movementInstructions",
    "coachingCues",
    "commonMistakes",
    "safetyNotes",
  ]) {
    assert.match(detail, new RegExp(`movement\\.${field}`), `MovementDetail must render ${field}`);
  }

  assert.match(detail, /Start position/i);
  assert.match(detail, /How to move/i);
  assert.match(detail, /Coaching cues/i);
  assert.match(detail, /Common mistakes/i);
  assert.match(detail, /Safety/i);
});
