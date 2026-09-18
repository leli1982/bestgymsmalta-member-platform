import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const scanRoutePath = join(root, "app/api/system/barcode/scan/route.ts");
const finalizeRoutePath = join(root, "app/api/system/barcode/finalize/route.ts");
const receptionComponentPath = join(root, "components/staff/BarcodeReceptionPage.tsx");
const photoComponentPath = join(root, "components/staff/OfficialMemberPhotoCapture.tsx");
const migrationPath = join(root, "supabase/migrations/20260918_103000_nonblocking_photo_warning.sql");

test("valid membership access is never denied only because the official photo is missing", () => {
  const route = readFileSync(scanRoutePath, "utf8");
  assert.match(route, /normalizeBarcodePayload/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /const membershipDecision = evaluateBarcodeAccess/);
  assert.match(route, /decision = membershipDecision/);
  assert.doesNotMatch(route, /photo_required["']\s*,\s*granted:\s*false/);
  assert.match(route, /photoRequired:\s*!hasPhoto/);
  assert.match(route, /recordCanonicalCheckin/);
  assert.match(route, /todayMaltaDate/);
  assert.doesNotMatch(route, /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/);
});

test("access scans store photo warning separately from the access result", () => {
  assert.equal(existsSync(migrationPath), true, "nonblocking photo-warning migration must exist");
  const migration = readFileSync(migrationPath, "utf8");
  const route = readFileSync(scanRoutePath, "utf8");

  assert.match(migration, /photo_required_warning\s+boolean\s+not\s+null\s+default\s+false/i);
  assert.match(route, /photo_required_warning:\s*photoRequired/);
  assert.match(route, /result:\s*decision\.result/);
  assert.match(route, /checkin_id:\s*checkinId/);
});

test("historical photo-required finalizer remains available only for old audit rows", () => {
  assert.equal(existsSync(finalizeRoutePath), true, "historical barcode finalize route remains readable");
  const route = readFileSync(finalizeRoutePath, "utf8");
  assert.match(route, /bgm_finalize_photo_required_barcode_access/);
  assert.doesNotMatch(readFileSync(receptionComponentPath, "utf8"), /\/api\/system\/barcode\/finalize/);
});

test("reception grants access normally and shows a separate repeating PHOTO REQUIRED warning", () => {
  const component = readFileSync(receptionComponentPath, "utf8");
  assert.match(component, /ACCESS GRANTED/);
  assert.match(component, /PHOTO REQUIRED/);
  assert.match(component, /photoRequired/);
  const photoComponent = readFileSync(photoComponentPath, "utf8");
  assert.match(photoComponent, /Take Photo with Webcam/);
  assert.match(photoComponent, /Upload Photo/);
  assert.match(component, /Allow Entry \/ Close/);
  assert.match(component, /OfficialMemberPhotoCapture/);
  assert.match(component, /memberId=/);
  assert.doesNotMatch(component, /No check-in has been created yet/);
  assert.doesNotMatch(component, /finalizePhotoAccess/);
});
