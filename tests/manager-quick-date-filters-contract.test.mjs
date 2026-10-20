import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../components/manager/GymManagerPortal.tsx", import.meta.url), "utf8");

test("manager dashboard exposes Today, This Week, and This Month quick filters", () => {
  assert.match(source, />Today</);
  assert.match(source, />This Week</);
  assert.match(source, />This Month</);
  assert.match(source, /applyQuickRange/);
  assert.match(source, /setFrom\(/);
  assert.match(source, /setTo\(/);
  assert.match(source, /activeQuickRange/);
});
