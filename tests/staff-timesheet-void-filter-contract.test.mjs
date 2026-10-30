import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("lib/staffTimesheetQueryServer.ts", "utf8");

test("normal staff timesheets exclude void sessions", () => {
  assert.match(source, /if \(status\) sessionQuery = sessionQuery\.eq\("status", status\);\s*else sessionQuery = sessionQuery\.neq\("status", "void"\);/);
});
