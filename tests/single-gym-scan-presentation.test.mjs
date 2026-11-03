import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("all staff scan surfaces show the assigned gym for restricted members", () => {
  const global = read("components/staff/StaffGlobalScanner.tsx");
  const home = read("components/staff/StaffHomeScanner.tsx");
  const barcode = read("components/staff/BarcodeReceptionPage.tsx");
  const nfc = read("components/staff/NfcReceptionPage.tsx");

  assert.match(global, /restricted_gym/);
  assert.match(global, /accessGymName/);
  assert.match(global, /ACCESS ONLY/);

  assert.match(home, /restricted_gym/);
  assert.match(home, /accessGymName/);
  assert.match(home, /ACCESS ONLY/);

  assert.match(barcode, /restricted_gym/);
  assert.match(barcode, /accessGymName/);
  assert.match(barcode, /ACCESS ONLY/);

  assert.match(nfc, /nfcReceptionPresentation\(result\.result, result\.member\?\.accessGymName\)/);
});
