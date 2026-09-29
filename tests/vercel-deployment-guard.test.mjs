import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("vercel.json", "utf8"));

test("staff branch stays suppressed and enrollment previews use an explicit checkpoint switch", () => {
  assert.equal(config.git.deploymentEnabled["feature/staff-dashboard-reception"], false);
  assert.equal(
    typeof config.git.deploymentEnabled["feature/tablet-enrollment-membership-settings"],
    "boolean"
  );
});
