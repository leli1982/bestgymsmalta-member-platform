import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { movementCatalog } from "../lib/movements/catalog.ts";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
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

test("the approved first movement-visual batch has stable static WebP assets", () => {
  const byId = new Map(movementCatalog.map((movement) => [movement.id, movement]));

  assert.equal(firstVisualBatch.length, 12);

  for (const id of firstVisualBatch) {
    const movement = byId.get(id);
    assert.ok(movement, `approved visual movement is missing from catalogue: ${id}`);
    assert.equal(movement.diagramAsset, `/movements/${id}.webp`);
    assert.equal(
      movement.diagramAsset.includes(".."),
      false,
      `${id} asset path must not escape /movements/`,
    );

    const assetPath = join(publicRoot, movement.diagramAsset.replace(/^\//, ""));
    assert.ok(existsSync(assetPath), `approved artwork is missing for ${id}`);
    assert.ok(statSync(assetPath).size > 1_000, `${id} artwork must not be an empty/tiny placeholder`);
  }
});
