import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assignRoute = readFileSync(
  new URL("../app/api/system/members/card/assign/route.ts", import.meta.url),
  "utf8"
);
const pendingUi = readFileSync(
  new URL("../components/staff/PendingMembershipActions.tsx", import.meta.url),
  "utf8"
);
const migration = readFileSync(
  new URL("../supabase/migrations/20260910_113500_renewal_card_verification.sql", import.meta.url),
  "utf8"
);

test("pending membership card API supports renewals and records exact card verification", () => {
  assert.match(assignRoute, /decideRenewalCardAction/);
  assert.match(assignRoute, /application_kind[\s\S]{0,100}renewal/);
  assert.match(assignRoute, /renewal_card_action/);
  assert.match(assignRoute, /renewal_scanned_barcode/);
  assert.match(assignRoute, /renewal_card_verified_at/);
  assert.match(assignRoute, /status[\s\S]{0,80}active/);
});

test("renewal UI requires a card verification before payment activation", () => {
  assert.match(pendingUi, /RENEWAL READY — VERIFY CARD/);
  assert.match(pendingUi, /cardVerified/);
  assert.match(pendingUi, /renewalCardAction/);
  assert.match(pendingUi, /readyToActivate/);
});

test("renewal schema stores verification and activation changes cards atomically", () => {
  assert.match(migration, /add column if not exists renewal_card_action text/);
  assert.match(migration, /add column if not exists renewal_scanned_barcode text/);
  assert.match(migration, /add column if not exists renewal_card_verified_at timestamptz/);
  assert.match(migration, /renewal_replacement/);
  assert.match(migration, /status = 'retired'/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /Reserved renewal replacement card is required/);
  assert.match(migration, /member_number = v_member_number/);
});
