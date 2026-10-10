import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/member/workout-plan/route.ts", import.meta.url), "utf8");
const trainer = readFileSync(new URL("../components/trainer/AiTrainer.tsx", import.meta.url), "utf8");

test("generated known Trainer exercises gain stable movement IDs without changing programming", () => {
  assert.match(route, /resolveMovement/);
  assert.match(route, /movementId:\s*movement\.id/);
  assert.match(route, /Chest Press Machine["']\s*,\s*sets:\s*guide\.main\s*,\s*reps:\s*guide\.reps/);
  assert.match(route, /Dumbbell Curl/);
  assert.match(route, /return\s+movement\s*\?\s*\{\s*\.\.\.exercise,\s*movementId:\s*movement\.id\s*\}\s*:\s*exercise/);
});

test("Trainer rendering supports legacy strings, legacy objects, IDs, aliases and unknown fallbacks", () => {
  assert.match(trainer, /movementId\?:\s*string/);
  assert.match(trainer, /import\s+MovementCard/);
  assert.match(trainer, /resolveMovement/);

  assert.match(trainer, /typeof exercise === ["']string["']/);
  assert.match(trainer, /resolveMovement\(exercise\)/);
  assert.match(trainer, /name=\{exercise\}/);

  assert.match(trainer, /resolveMovement\(\{[\s\S]*movementId:\s*exercise\.movementId,[\s\S]*name:\s*exercise\.name,[\s\S]*\}\)/);
  assert.match(trainer, /name=\{name\}/);
  assert.match(trainer, /sets:\s*exercise\.sets/);
  assert.match(trainer, /reps:\s*exercise\.reps/);
  assert.match(trainer, /notes:\s*exercise\.notes/);
  assert.match(trainer, /context=["']trainer["']/);
});

test("Trainer keeps its existing API endpoint and does not rewrite loaded plans just for resolution", () => {
  assert.match(trainer, /\/api\/member\/workout-plan/);
  assert.doesNotMatch(trainer, /movementId\s*=\s*movement\.id/);
  assert.doesNotMatch(trainer, /exercise\.name\s*=\s*movement\.name/);
});
