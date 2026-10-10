import assert from "node:assert/strict";
import test from "node:test";

import { movementCatalog } from "../lib/movements/catalog.ts";
import { movementVisualAssets } from "../lib/movements/visualAssets.ts";

const firstVisualBatch = [
  "chest-press-machine",
  "lat-pulldown",
  "leg-press",
  "romanian-deadlift",
  "goblet-squat",
  "seated-cable-row",
  "shoulder-press-machine",
  "dumbbell-biceps-curl",
  "triceps-rope-pushdown",
  "90-90-hip-switch",
  "cat-cow",
  "half-kneeling-hip-flexor-stretch",
];

function decodeWebpDataUri(value) {
  assert.match(value, /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
  const bytes = Buffer.from(value.slice("data:image/webp;base64,".length), "base64");
  assert.ok(bytes.length > 1_000, "movement artwork must not be an empty/tiny placeholder");
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
}

test("the approved first movement-visual batch has stable catalogue paths and embedded WebP artwork", () => {
  const byId = new Map(movementCatalog.map((movement) => [movement.id, movement]));

  assert.equal(firstVisualBatch.length, 12);

  for (const id of firstVisualBatch) {
    const movement = byId.get(id);
    assert.ok(movement, `approved visual movement is missing from catalogue: ${id}`);
    assert.equal(movement.diagramAsset, `/movements/${id}.webp`);
    assert.equal(movement.diagramAsset.includes(".."), false, `${id} asset path must not escape /movements/`);

    const artwork = movementVisualAssets[id];
    assert.ok(artwork, `approved artwork is missing for ${id}`);
    decodeWebpDataUri(artwork);
  }
});
