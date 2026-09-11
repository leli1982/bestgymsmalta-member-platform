import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const scanRoutePath = join(root, "app/api/system/barcode/scan/route.ts");
const finalizeRoutePath = join(root, "app/api/system/barcode/finalize/route.ts");
const receptionComponentPath = join(root, "components/staff/BarcodeReceptionPage.tsx");
const migrationPath = join(root, "supabase/migrations/20260911_100000_reception_photo_gate.sql");

test("reception resolves opaque card credentials and gates active members without photos", () => {
  const route = readFileSync(scanRoutePath, "utf8");
  assert.match(route, /normalizeBarcodePayload/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /barcode_value/);
  assert.match(route, /unknown_card/);
  assert.match(route, /disabled_card/);
  assert.match(route, /photo_required/);
  assert.match(route, /photoUrl/);
  assert.doesNotMatch(route, /officialPhotoPath\s*:/);
});

test("photo-required access finalization is server-authorized and delegated to an idempotent database transaction", () => {
  assert.equal(existsSync(finalizeRoutePath), true, "barcode finalize route must exist");
  const route = readFileSync(finalizeRoutePath, "utf8");
  assert.match(route, /requireSystemPermission\(request,\s*"barcode\.scan"\)/);
  assert.match(route, /scanId/);
  assert.match(route, /bgm_finalize_photo_required_barcode_access/);
});

test("database photo gate records PHOTO REQUIRED and finalizes exactly one canonical barcode check-in", () => {
  assert.equal(existsSync(migrationPath), true, "reception photo-gate migration must exist");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /photo_required/);
  assert.match(migration, /create or replace function public\.bgm_finalize_photo_required_barcode_access/);
  assert.match(migration, /from public\.bgm_access_scans[\s\S]*for update/i);
  assert.match(migration, /official_photo_path/);
  assert.match(migration, /bgm_member_card_credentials/);
  assert.match(migration, /insert into public\.bgm_member_checkins/);
  assert.match(migration, /source[\s\S]*'barcode'/i);
  assert.match(migration, /checkin_id/);
  assert.match(migration, /result = 'granted'/);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
  assert.match(migration, /revoke[\s\S]*authenticated/i);
});

test("reception UI shows secure member photos, CARD REPLACED and inline PHOTO REQUIRED capture", () => {
  const component = readFileSync(receptionComponentPath, "utf8");
  assert.match(component, /OfficialMemberPhotoCapture/);
  assert.match(component, /photo_required/);
  assert.match(component, /PHOTO REQUIRED/);
  assert.match(component, /disabled_card/);
  assert.match(component, /CARD REPLACED/);
  assert.match(component, /photoUrl/);
  assert.match(component, /\/api\/system\/barcode\/finalize/);
  assert.match(component, /memberId=/);
});
