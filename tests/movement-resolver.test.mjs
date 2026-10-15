import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const resolverUrl = new URL("../lib/movements/resolveMovement.ts", import.meta.url);
assert.ok(existsSync(fileURLToPath(resolverUrl)), "movement resolver must exist");

const { normalizeMovementName, resolveMovement } = await import(resolverUrl.href);

test("resolves canonical names with narrow case and whitespace normalization", () => {
  assert.equal(resolveMovement("Lat Pulldown")?.id, "lat-pulldown");
  assert.equal(resolveMovement("  LAT   Pulldown  ")?.id, "lat-pulldown");
  assert.equal(normalizeMovementName("  LAT   Pulldown  "), "lat pulldown");
});

test("resolves only explicitly approved aliases", () => {
  assert.equal(resolveMovement("Dumbbell Curl")?.id, "dumbbell-biceps-curl");
  assert.equal(resolveMovement("Cat-Cow Stretch")?.id, "cat-cow");
});

test("preserves meaningful punctuation such as the 90/90 mobility name", () => {
  assert.equal(normalizeMovementName("90/90 Hip Switch"), "90/90 hip switch");
  assert.equal(resolveMovement("90/90 Hip Switch")?.id, "90-90-hip-switch");
});

test("a known explicit movement ID wins over a conflicting display name", () => {
  assert.equal(
    resolveMovement({ movementId: "lat-pulldown", name: "Leg Press" })?.id,
    "lat-pulldown",
  );
});

test("an unknown explicit ID may fall back to an independently valid name", () => {
  assert.equal(
    resolveMovement({ movementId: "not-a-real-id", name: "Leg Press" })?.id,
    "leg-press",
  );
});

test("empty, null-like and unknown names do not resolve", () => {
  assert.equal(resolveMovement(""), null);
  assert.equal(resolveMovement("   "), null);
  assert.equal(resolveMovement({ movementId: null, name: null }), null);
  assert.equal(resolveMovement("Imaginary Cable Moon Press"), null);
});

test("similar exercise names never fuzzy-match to a different movement", () => {
  assert.equal(resolveMovement("Lat Pull"), null);
  assert.equal(resolveMovement("Romanian Deadlift Machine"), null);
  assert.equal(resolveMovement("Cable Row"), null);
});

test("materially different Romanian deadlift variants remain distinct", () => {
  assert.equal(resolveMovement("Romanian Deadlift")?.id, "romanian-deadlift");
  assert.equal(
    resolveMovement("Dumbbell Romanian Deadlift")?.id,
    "dumbbell-romanian-deadlift",
  );
});
