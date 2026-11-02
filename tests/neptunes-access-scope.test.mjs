import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("schema stores explicit access scope and migrates only verified legacy NO members", () => {
  const migration = read("supabase/migrations/20261102_214500_neptunes_only_access.sql");
  assert.match(migration, /access_scope/);
  assert.match(migration, /network/);
  assert.match(migration, /neptunes_only/);
  assert.match(migration, /legacy_pk_customer/);
  assert.match(migration, /real_import_batch_id is not null/i);
  assert.match(migration, /like 'NO%'/i);
  assert.match(migration, /restricted_gym/);
  assert.match(migration, /application_kind = 'new'/i);
});

test("barcode and NFC evaluators enforce Neptunes-only scope with gym context", () => {
  const barcode = read("lib/barcodeAccessCore.ts");
  const nfc = read("lib/nfcAccessCore.ts");
  for (const source of [barcode, nfc]) {
    assert.match(source, /restricted_gym/);
    assert.match(source, /accessScope/);
    assert.match(source, /gymId/);
    assert.match(source, /bgm-neptunes/);
  }
});

test("staffed scan routes select access scope and pass current gym to access evaluation", () => {
  const barcode = read("app/api/system/barcode/scan/route.ts");
  const nfc = read("app/api/system/nfc/scan/route.ts");
  for (const source of [barcode, nfc]) {
    assert.match(source, /access_scope/);
    assert.match(source, /accessScope/);
    assert.match(source, /gymId/);
  }
});

test("offline roster carries scope and excludes Neptunes-only members at other gyms", () => {
  const route = read("app/api/system/offline-roster/route.ts");
  const core = read("lib/offlineRosterCore.ts");
  assert.match(route, /access_scope/);
  assert.match(route, /member\.accessScope !== "neptunes_only"/);
  assert.match(route, /currentGymId === NEPTUNES_GYM_ID/);
  assert.match(core, /accessScope/);
});

test("pending new applications can set explicit scope without deriving it from vouchers", () => {
  const route = read("app/api/system/members/applications/[applicationId]/access-scope/route.ts");
  assert.match(route, /accessScope/);
  assert.match(route, /neptunes_only/);
  assert.match(route, /bgm-neptunes/);
  assert.match(route, /application_kind/);
  assert.doesNotMatch(route, /discount|voucher/i);
});