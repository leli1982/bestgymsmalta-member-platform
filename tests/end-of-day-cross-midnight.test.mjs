import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("End of Day financial window continues across midnight until the next submission", () => {
  const migration = read("supabase/migrations/20261103_160000_eod_cross_midnight_carry.sql");

  assert.match(migration, /order by\s+shift_ended_at\s+desc/i);
  assert.match(migration, /coalesce\(payment_received_at,\s*activated_at,\s*submitted_at\)\s*>\s*v_shift_start/i);
  assert.match(migration, /coalesce\(payment_received_at,\s*activated_at,\s*submitted_at\)\s*<=\s*v_shift_end/i);
  assert.doesNotMatch(migration, /payment_business_date\s*=\s*p_business_date/i);
});

test("Bar working sheet is not reset or replaced merely because Malta date changes", () => {
  const migration = read("supabase/migrations/20261103_160000_eod_cross_midnight_carry.sql");
  const barRoute = read("app/api/system/bar/today/route.ts");

  assert.match(migration, /order by\s+updated_at\s+desc/i);
  assert.match(migration, /delete from public\.bgm_operational_order_items/i);
  assert.match(migration, /total_cents\s*=\s*0/i);
  assert.doesNotMatch(migration, /where[\s\S]{0,250}business_date\s*=\s*p_business_date[\s\S]{0,250}for update/i);

  assert.match(barRoute, /order\("updated_at",\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.doesNotMatch(barRoute, /\.eq\("business_date",\s*businessDate\)\s*\.maybeSingle\(\)/);
});

test("Staff EOD preview carries memberships and renewals from the previous EOD timestamp across midnight", () => {
  const route = read("app/api/system/end-of-day/route.ts");

  assert.match(route, /shiftStartDate\s*=\s*shiftStartedAt\s*\?\s*todayMaltaDate\(new Date\(shiftStartedAt\)\)/);
  assert.match(route, /\.gte\("payment_business_date",\s*shiftStartDate\)/);
  assert.match(route, /eventTime[\s\S]{0,200}>\s*new Date\(shiftStartedAt\)\.getTime\(\)/);
  assert.doesNotMatch(route, /\.eq\("payment_business_date",\s*businessDate\)/);
});

test("EOD categories and calculations remain unchanged", () => {
  const migration = read("supabase/migrations/20261103_160000_eod_cross_midnight_carry.sql");

  assert.match(migration, /application_kind\s*=\s*'new'/i);
  assert.match(migration, /application_kind\s*=\s*'renewal'/i);
  assert.match(migration, /discount_reimbursement_cents_snapshot/i);
  assert.match(migration, /v_bar_sales/i);
  assert.match(migration, /v_expenses_total/i);
  assert.match(migration, /v_gross/i);
  assert.match(migration, /v_daily_total/i);
});
