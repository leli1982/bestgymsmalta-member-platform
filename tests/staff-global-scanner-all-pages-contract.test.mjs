import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");
const globalScanner = readFileSync(new URL("../components/staff/StaffGlobalScanner.tsx", import.meta.url), "utf8");

test("global staff scanner stays mounted for every staff route including reception", () => {
  assert.match(layout, /<StaffGlobalScanner \/>/);
  assert.doesNotMatch(globalScanner, /pathname\.startsWith\("\/staff\/reception"\)/);
});

test("global scanner still protects active form fields while recognizing keyboard scanner bursts", () => {
  assert.match(globalScanner, /activeScannerEditable/);
  assert.match(globalScanner, /looksLikeKeyboardBarcode/);
  assert.match(globalScanner, /stopImmediatePropagation/);
  assert.match(globalScanner, /window\.addEventListener\("keydown", onKeyDown, true\)/);
});
