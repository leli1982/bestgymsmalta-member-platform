import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  new URL("../app/api/system/barcode/scan/route.ts", import.meta.url),
  "utf8"
);
const reception = fs.readFileSync(
  new URL("../components/staff/BarcodeReceptionPage.tsx", import.meta.url),
  "utf8"
);
const page = fs.readFileSync(
  new URL("../app/staff/reception/page.tsx", import.meta.url),
  "utf8"
);
const staffHome = fs.readFileSync(
  new URL("../components/staff/StaffLoginPage.tsx", import.meta.url),
  "utf8"
);

test("barcode scan resolves member number directly", () => {
  assert.match(route, /barcode\.scan/);
  assert.match(route, /member_number/);
  assert.match(route, /source:\s*["']barcode["']/);
  assert.match(route, /credential_type:\s*["']barcode["']/);
  assert.match(route, /credential_value:\s*membershipNumber/);
  assert.doesNotMatch(route, /bgm_nfc_cards/);
});

test("launch reception uses barcode scanner UX", () => {
  assert.match(reception, /Reception \/ Barcode/);
  assert.match(reception, /READY TO SCAN/);
  assert.match(reception, /Barcode scanner input/);
  assert.match(reception, /MEMBER NOT FOUND/);
  assert.match(reception, /\/api\/system\/barcode\/scan/);
  assert.doesNotMatch(reception, /Assign NFC|Replace NFC/);
  assert.match(page, /BarcodeReceptionPage/);
  assert.doesNotMatch(page, /NfcReceptionPage/);
});

test("enabled staff reception tile navigates with barcode permission", () => {
  assert.match(staffHome, /Reception \/ Barcode/);
  assert.match(staffHome, /barcode\.scan/);
  assert.match(staffHome, /href="\/staff\/reception"/);
  assert.match(staffHome, /enabled\s*&&\s*href/);
});
