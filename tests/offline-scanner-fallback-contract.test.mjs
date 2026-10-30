import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const scanner = fs.readFileSync(new URL("../components/staff/StaffGlobalScanner.tsx", import.meta.url), "utf8");

test("scanner keeps live verification unchanged and only uses roster fallback when browser is offline", () => {
  assert.match(scanner, /fetch\("\/api\/system\/barcode\/scan"/);
  assert.match(scanner, /navigator\.onLine\s*===\s*false/);
  assert.match(scanner, /loadOfflineRoster/);
  assert.match(scanner, /OFFLINE LOOKUP/);
  assert.match(scanner, /NOT LIVE VERIFIED/);
});
