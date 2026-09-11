import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const service = fs.readFileSync(
  new URL("../lib/checkinService.ts", import.meta.url),
  "utf8"
);
const qrRoute = fs.readFileSync(
  new URL("../app/api/checkins/route.ts", import.meta.url),
  "utf8"
);
const nfcRoute = fs.readFileSync(
  new URL("../app/api/system/nfc/scan/route.ts", import.meta.url),
  "utf8"
);

test("canonical checkin service accepts qr nfc and barcode sources", () => {
  assert.match(service, /"qr"\s*\|\s*"nfc"\s*\|\s*"barcode"/);
  assert.match(service, /recordCanonicalCheckin/);
  assert.match(service, /bgm_member_checkins/);
  assert.match(service, /bgm_member_stats/);
});

test("QR and NFC routes delegate checkin writes to the canonical service", () => {
  assert.match(qrRoute, /recordCanonicalCheckin/);
  assert.match(qrRoute, /source:\s*["']qr["']/);
  assert.doesNotMatch(qrRoute, /\.from\(["']bgm_member_checkins["']\)\s*\.insert/);

  assert.match(nfcRoute, /recordCanonicalCheckin/);
  assert.match(nfcRoute, /source:\s*["']nfc["']/);
  assert.doesNotMatch(nfcRoute, /\.from\(["']bgm_member_checkins["']\)\s*\.insert/);
});

test("NFC access attempts identify their credential explicitly", () => {
  assert.match(nfcRoute, /credential_type:\s*["']nfc["']/);
  assert.match(nfcRoute, /credential_value:\s*cardUid/);
});
