import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const catalogUrl = new URL("../lib/movements/catalog.ts", import.meta.url);
const groupsUrl = new URL("../lib/movements/mobilityGroups.ts", import.meta.url);
const trainerUrl = new URL("../app/api/member/workout-plan/route.ts", import.meta.url);
const mobilityUrl = new URL("../components/mobility/MobilityStretchPage.tsx", import.meta.url);

assert.ok(existsSync(fileURLToPath(catalogUrl)), "movement catalog must exist");
assert.ok(existsSync(fileURLToPath(groupsUrl)), "mobility groups must exist");

const { movementCatalog } = await import(catalogUrl.href);
const { mobilityGroups } = await import(groupsUrl.href);

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function sourceMovementNames(url) {
  const source = readFileSync(fileURLToPath(url), "utf8");
  return [...source.matchAll(/\bname:\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function representedNames() {
  const names = new Map();
  for (const movement of movementCatalog) {
    names.set(normalize(movement.name), movement.id);
    for (const alias of movement.aliases) names.set(normalize(alias), movement.id);
  }
  return names;
}

test("movement IDs and canonical names are unique", () => {
  const ids = movementCatalog.map((movement) => movement.id);
  const names = movementCatalog.map((movement) => normalize(movement.name));

  assert.ok(ids.every(Boolean), "movement IDs must be non-empty");
  assert.ok(names.every(Boolean), "movement names must be non-empty");
  assert.equal(new Set(ids).size, ids.length, "movement IDs must be unique");
  assert.equal(new Set(names).size, names.length, "canonical movement names must be unique");
});

test("aliases are non-empty and never collide with another movement", () => {
  const ownerByName = new Map();

  for (const movement of movementCatalog) {
    const values = [movement.name, ...movement.aliases];
    for (const value of values) {
      const key = normalize(value);
      assert.ok(key, `movement ${movement.id} contains an empty name or alias`);
      const existingOwner = ownerByName.get(key);
      assert.ok(!existingOwner || existingOwner === movement.id, `${value} collides between ${existingOwner} and ${movement.id}`);
      ownerByName.set(key, movement.id);
    }
  }
});

test("mobility groups reference real movement IDs", () => {
  const ids = new Set(movementCatalog.map((movement) => movement.id));
  assert.ok(mobilityGroups.length > 0, "mobility groups must not be empty");

  for (const group of mobilityGroups) {
    assert.ok(group.id && group.label && group.intro, "mobility group metadata must be complete");
    assert.ok(group.entries.length > 0, `${group.id} must contain at least one movement`);
    for (const entry of group.entries) {
      assert.ok(ids.has(entry.movementId), `${group.id} references missing movement ${entry.movementId}`);
    }
  }
});

test("all current Trainer exercise names are represented by a canonical name or approved alias", () => {
  const names = representedNames();
  const trainerNames = sourceMovementNames(trainerUrl);
  assert.ok(trainerNames.length > 20, "expected current Trainer exercise seed data");
  for (const name of trainerNames) assert.ok(names.has(normalize(name)), `Trainer movement is missing from catalog: ${name}`);
});

test("all current Mobility & Stretch movement names are represented", () => {
  const names = representedNames();
  const mobilityNames = sourceMovementNames(mobilityUrl);
  assert.ok(mobilityNames.length > 20, "expected current Mobility & Stretch seed data");
  for (const name of mobilityNames) assert.ok(names.has(normalize(name)), `Mobility movement is missing from catalog: ${name}`);
});

test("diagram assets remain optional while the catalogue is first seeded", () => {
  for (const movement of movementCatalog) {
    if (movement.diagramAsset !== undefined) assert.equal(typeof movement.diagramAsset, "string");
  }
});
