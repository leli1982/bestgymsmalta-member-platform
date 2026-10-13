import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { movementCatalog } from "../lib/movements/catalog.ts";
import { mobilityGroups } from "../lib/movements/mobilityGroups.ts";

const page = readFileSync(new URL("../components/mobility/MobilityStretchPage.tsx", import.meta.url), "utf8");

const expectedGroups = [
  ["fullBody", "Full Body"],
  ["chest", "Chest"],
  ["back", "Back"],
  ["shoulders", "Shoulders"],
  ["arms", "Arms"],
  ["legs", "Legs"],
  ["hips", "Hips"],
  ["neck", "Neck"],
  ["postWorkout", "Post-Workout"],
  ["desk", "Desk / Stiffness"],
];

test("Mobility keeps the current category IDs and labels in the shared grouping data", () => {
  const groups = new Map(mobilityGroups.map((group) => [group.id, group.label]));
  for (const [id, label] of expectedGroups) assert.equal(groups.get(id), label);
});

test("every Mobility group entry references the shared catalogue and can carry a programming override", () => {
  const movementIds = new Set(movementCatalog.map((movement) => movement.id));
  for (const group of mobilityGroups) {
    for (const entry of group.entries) {
      assert.ok(movementIds.has(entry.movementId), `${group.id} references missing movement ${entry.movementId}`);
      assert.equal(typeof entry.programming, "string");
      assert.ok(entry.programming.length > 0);
    }
  }
});

test("Mobility page renders shared movement cards without duplicating canonical stretch definitions", () => {
  assert.match(page, /import\s+MovementCard/);
  assert.match(page, /mobilityGroups/);
  assert.match(page, /resolveMovement/);
  assert.match(page, /category\.entries\.map/);
  assert.match(page, /movementId:\s*entry\.movementId/);
  assert.match(page, /<MovementCard/);
  assert.match(page, /duration:\s*entry\.programming/);
  assert.match(page, /context=["']mobility["']/);

  assert.doesNotMatch(page, /const\s+stretchCategories/);
  assert.doesNotMatch(page, /instructions:\s*["']/);
});

test("Mobility retains safety introduction and controlled category selector", () => {
  assert.match(page, /Important/);
  assert.match(page, /Stop if you feel pain,\s+numbness, dizziness or sharp discomfort/);
  assert.match(page, /value=\{selectedCategory\}/);
  assert.match(page, /setSelectedCategory\(event\.target\.value\)/);
});

test("representative shared Mobility movements remain in the grouping data", () => {
  const allIds = new Set(mobilityGroups.flatMap((group) => group.entries.map((entry) => entry.movementId)));
  for (const id of ["90-90-hip-switch", "wall-angels", "cat-cow", "half-kneeling-hip-flexor-stretch"]) {
    assert.ok(allIds.has(id), `missing representative Mobility movement ${id}`);
  }
});
