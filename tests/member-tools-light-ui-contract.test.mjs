import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const trainerPagePath = join(root, "app/trainer/page.tsx");
const trainerPath = join(root, "components/trainer/AiTrainer.tsx");
const mobilityPath = join(root, "components/mobility/MobilityStretchPage.tsx");
const progressPagePath = join(root, "app/progress/page.tsx");
const progressPath = join(root, "components/progress/ProgressVault.tsx");
const strengthPath = join(root, "components/progress/StrengthTracker.tsx");

test("primary member tools use the approved light application shell", () => {
  const trainerPage = readFileSync(trainerPagePath, "utf8");
  const mobility = readFileSync(mobilityPath, "utf8");
  const progressPage = readFileSync(progressPagePath, "utf8");

  assert.match(trainerPage, /<AppShell\s+theme=["']light["']/);
  assert.match(mobility, /<AppShell\s+theme=["']light["']/);
  assert.match(progressPage, /<AppShell\s+theme=["']light["']/);
  assert.doesNotMatch(progressPage, /import BottomNav/);
});

test("AI Trainer keeps its working plan API while presenting light functional surfaces", () => {
  const trainer = readFileSync(trainerPath, "utf8");

  assert.match(trainer, /data-member-surface=["']trainer-light["']/);
  assert.match(trainer, /border-zinc-200/);
  assert.match(trainer, /bg-white/);
  assert.match(trainer, /text-zinc-950/);
  assert.match(trainer, /\/api\/member\/workout-plan/);
  assert.match(trainer, /Generate Plan/);
});

test("Mobility and Stretch removes the legacy dark page while preserving the category selector", () => {
  const mobility = readFileSync(mobilityPath, "utf8");

  assert.match(mobility, /data-member-surface=["']mobility-light["']/);
  assert.doesNotMatch(mobility, /min-h-screen bg-neutral-950/);
  assert.match(mobility, /border-zinc-200/);
  assert.match(mobility, /bg-white/);
  assert.match(mobility, /text-zinc-950/);
  assert.match(mobility, /value=\{selectedCategory\}/);
});

test("Progress Vault and Strength Tracker use light working surfaces without changing data endpoints", () => {
  const progress = readFileSync(progressPath, "utf8");
  const strength = readFileSync(strengthPath, "utf8");

  assert.match(progress, /data-member-surface=["']progress-light["']/);
  assert.match(strength, /data-member-surface=["']strength-light["']/);
  assert.match(progress, /border-zinc-200/);
  assert.match(progress, /bg-white/);
  assert.match(progress, /text-zinc-950/);
  assert.match(strength, /border-zinc-200/);
  assert.match(strength, /bg-white/);
  assert.match(strength, /text-zinc-950/);
  assert.match(progress, /\/api\/member\/progress-photos/);
  assert.match(strength, /\/api\/member\/strength-progress/);
});
