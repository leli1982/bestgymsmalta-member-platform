import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Staff permission and dashboard expose End of Day", () => {
  assert.match(read("lib/systemPermissions.ts"), /"end_of_day\.submit"/);
  assert.match(read("components/staff/StaffDashboard.tsx"), /label="End of Day"/);
});

test("End of Day server uses Malta business-date snapshots and atomic submit RPC", () => {
  const route = read("app/api/system/end-of-day/route.ts");
  assert.match(route, /payment_business_date/);
  assert.match(route, /discount_reimbursement_cents_snapshot/);
  assert.match(route, /bgm_submit_end_of_day/);
  assert.match(route, /end_of_day\.submit/);
});

test("daily Bar is autosaved in-place and no manual send button remains", () => {
  const route = read("app/api/system/bar/today/route.ts");
  const ui = read("components/staff/BarSalesPage.tsx");
  assert.match(route, /bgm_save_daily_bar_sheet/);
  assert.match(route, /is_daily_sheet/);
  assert.match(ui, /Saving…/);
  assert.match(ui, /Offline – waiting to sync/);
  assert.doesNotMatch(ui, /SEND BAR LIST/);
});

test("voucher reimbursement is optional, generic and historically snapshotted", () => {
  const api = read("app/api/system/voucher-reimbursements/route.ts");
  const ui = read("components/staff/VoucherReimbursementAdmin.tsx");
  const migration = read("supabase/migrations/20261028103610_end_of_day_daily_bar_voucher_reimbursement.sql");
  assert.match(api, /reimbursement_value_cents/);
  assert.match(ui, /Value € \(optional\)/);
  assert.match(migration, /discount_reimbursement_cents_snapshot/);
  assert.match(migration, /application_kind = 'new'/);
});

test("End of Day migration serializes Bar save and submission for the same gym/date", () => {
  const migration = read("supabase/migrations/20261028105408_end_of_day_atomic_submit.sql");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /bgm_submit_end_of_day/);
  assert.match(migration, /locked_at = now\(\)/);
  assert.match(migration, /memberships_card/);
});

test("offline membership sync still carries the original Malta sale date", () => {
  const route = read("app/api/system/members/offline-sync/route.ts");
  assert.match(route, /soldOnMalta/);
  assert.match(route, /soldAt/);
});
