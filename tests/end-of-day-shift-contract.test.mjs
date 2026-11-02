import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("End of Day supports multiple non-overlapping shift closes", () => {
  const migration = read("supabase/migrations/20261102_211500_end_of_day_shift_closes.sql");
  assert.match(migration, /shift_sequence/);
  assert.match(migration, /shift_started_at/);
  assert.match(migration, /shift_ended_at/);
  assert.match(migration, /unique\s*\(gym_id,\s*business_date,\s*shift_sequence\)/i);
  assert.doesNotMatch(migration, /unique\s*\(gym_id,\s*business_date\)/i);
  assert.match(migration, /payment_received_at/);
  assert.match(migration, /v_shift_start/);
  assert.match(migration, /v_shift_end/);
});

test("successful shift close snapshots then resets the live Bar sheet", () => {
  const migration = read("supabase/migrations/20261102_211500_end_of_day_shift_closes.sql");
  assert.match(migration, /bgm_end_of_day_bar_items/);
  assert.match(migration, /delete from public\.bgm_operational_order_items/);
  assert.match(migration, /total_cents\s*=\s*0/);
  assert.match(migration, /locked_at\s*=\s*null/);
});

test("Staff preview opens the next shift and admin returns daily aggregates", () => {
  const route = read("app/api/system/end-of-day/route.ts");
  assert.match(route, /shift_sequence/);
  assert.match(route, /shift_started_at/);
  assert.match(route, /shift_ended_at/);
  assert.match(route, /dailyTotals/);
  assert.doesNotMatch(route, /submittedResult\.data\?\.id/);
});

test("Super Admin labels individual shifts and combined daily totals", () => {
  const ui = read("components/staff/EndOfDayAdminPage.tsx");
  assert.match(ui, /Shift \{report\.shiftSequence\}/);
  assert.match(ui, /Daily Total/);
  assert.match(ui, /shiftStartedAt/);
  assert.match(ui, /shiftEndedAt/);
});