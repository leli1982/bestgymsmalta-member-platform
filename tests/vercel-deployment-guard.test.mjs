import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("vercel.json", "utf8"));

test("feature branches are Vercel-suppressed", () => {
  assert.equal(config.git.deploymentEnabled["feature/staff-dashboard-reception"], false);
  assert.equal(config.git.deploymentEnabled["feature/tablet-enrollment-membership-settings"], false);
});
