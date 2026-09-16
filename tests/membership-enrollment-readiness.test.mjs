import assert from "node:assert/strict";
import test from "node:test";
import { getEnrollmentReadiness } from "../lib/membershipEnrollmentReadiness.ts";

test("enrollment stays closed when privacy and health declarations are missing", () => {
  assert.deepEqual(getEnrollmentReadiness(new Set(["gym_rules"])), {
    ready: false,
    missing: ["privacy", "health"],
  });
});

test("enrollment stays closed when Gym Rules are missing", () => {
  assert.deepEqual(getEnrollmentReadiness(new Set(["privacy", "health"])), {
    ready: false,
    missing: ["gym_rules"],
  });
});

test("enrollment becomes ready only with all required published categories", () => {
  assert.deepEqual(
    getEnrollmentReadiness(new Set(["gym_rules", "legacy_declaration", "privacy", "health"])),
    { ready: true, missing: [] }
  );
});

test("guardian and legacy declaration are not universal launch blockers", () => {
  assert.deepEqual(getEnrollmentReadiness(new Set(["gym_rules", "privacy", "health"])), {
    ready: true,
    missing: [],
  });
});
