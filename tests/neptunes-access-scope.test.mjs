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

test("barcode and NFC evaluators preserve legacy Neptunes-only enforcement during generic rollout", () => {
  const barcode = read("lib/barcodeAccessCore.ts");
  const nfc = read("lib/nfcAccessCore.ts");
  for (const source of [barcode, nfc]) {
    assert.match(source, /restricted_gym/);
    assert.match(source, /accessScope/);
    assert.match(source, /accessGymId/);
    assert.match(source, /gymId/);
    assert.match(source, /bgm-neptunes/);
  }
});

test("staffed scan routes select target gym and pass it to generic access evaluation", () => {
  const barcode = read("app/api/system/barcode/scan/route.ts");
  const nfc = read("app/api/system/nfc/scan/route.ts");
  for (const source of [barcode, nfc]) {
    assert.match(source, /access_scope/);
    assert.match(source, /access_gym_id/);
    assert.match(source, /accessScope/);
    assert.match(source, /accessGymId/);
    assert.match(source, /gymId/);
  }
});

test("offline roster carries target gym and filters any restricted member to that gym", () => {
  const route = read("app/api/system/offline-roster/route.ts");
  const core = read("lib/offlineRosterCore.ts");
  assert.match(route, /access_gym_id/);
  assert.match(route, /member\.accessScope === "network"/);
  assert.match(route, /member\.accessGymId === currentGymId/);
  assert.match(core, /accessGymId/);
  assert.match(core, /single_gym/);
});

test("pending applications use the generic explicit scope endpoint during staged rollout", () => {
  const route = read("app/api/system/members/applications/[applicationId]/access-scope/route.ts");
  assert.match(route, /accessScope/);
  assert.match(route, /neptunes_only/);
  assert.match(route, /requestedScope === "neptunes_only" \? "single_gym" : requestedScope/);
  assert.match(route, /accessScope === "single_gym" \? application\.enrollment_gym_id : null/);
  assert.match(route, /single_gym_pricing_enabled/);
  assert.match(route, /application_kind/);
  assert.doesNotMatch(route, /discount|voucher/i);
});
