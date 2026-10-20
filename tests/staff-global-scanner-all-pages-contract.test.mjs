import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");
const globalScanner = readFileSync(new URL("../components/staff/StaffGlobalScanner.tsx", import.meta.url), "utf8");
const reception = readFileSync(new URL("../components/staff/BarcodeReceptionPage.tsx", import.meta.url), "utf8");

test("global staff scanner stays mounted for every staff route including reception", () => {
  assert.match(layout, /<StaffGlobalScanner \/>/);
  assert.doesNotMatch(globalScanner, /pathname\.startsWith\("\/staff\/reception"\)/);
});

test("focused reception scanner input opts out of the global keyboard listener to prevent duplicate scans", () => {
  assert.match(reception, /data-bgm-scan-input="true"/);
  assert.match(globalScanner, /data-bgm-scan-input/);
});
