import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const fixPath = new URL("../supabase/migrations/20261027_155000_offline_membership_sync_card_case_fix.sql", import.meta.url);
const route = fs.readFileSync(new URL("../app/api/system/members/offline-sync/route.ts", import.meta.url), "utf8");

test("offline sync preserves the exact physical-card credential characters", () => {
  assert.match(route, /normalizeBarcodePayload/);
  assert.match(route, /pendingCardValues[\s\S]*normalizeBarcodePayload/);
  assert.equal(fs.existsSync(fixPath), true, "card case-preservation migration must exist");
  const migration = fs.readFileSync(fixPath, "utf8");
  assert.match(migration, /v_card_value := btrim\(v_cards->>/i);
  assert.doesNotMatch(migration, /v_card_value := upper\(/i);
});
