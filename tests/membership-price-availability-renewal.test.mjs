import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/system/members/available-prices/route.ts", import.meta.url), "utf8");
const renewal = fs.readFileSync(new URL("../components/staff/StaffRenewalEnrollmentPage.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260924_151000_membership_price_option_availability.sql", import.meta.url), "utf8");

test("renewal pricing reads active nonzero entries from the published catalog with renew permission", () => {
  assert.match(route, /requireSystemPermission\(request, "members\.renew"\)/);
  assert.match(route, /\.eq\("status", "published"\)/);
  assert.match(route, /\.eq\("catalog_version_id", catalog\.data\.id\)/);
  assert.match(route, /\.eq\("is_active", true\)/);
  assert.match(route, /\.gt\("amount_cents", 0\)/);
});
test("renewal form filters durations by published rates and blocks invalid selections", () => {
  assert.match(renewal, /fetch\("\/api\/system\/members\/available-prices"/);
  assert.match(renewal, /availableDurations = DURATIONS\.filter/);
  assert.match(renewal, /availableDurations\.map/);
  assert.match(renewal, /availablePrices\.some\(\(entry\) => entry\.membershipType === membershipType && entry\.durationKey === durationKey\)/);
});
test("renewal shows the selected duration's currently published price before submission", () => {
  assert.match(renewal, /selectedPrice = availablePrices\.find/);
  assert.match(renewal, /entry\.membershipType === membershipType && entry\.durationKey === durationKey/);
  assert.match(renewal, /Current published renewal price/);
  assert.match(renewal, /selectedPrice\.amountCents \/ 100/);
  assert.match(renewal, /Before any applicable discount/);
});
test("published price changes never recalculate historical applications", () => {
  assert.match(migration, /before insert on public\.bgm_membership_applications/);
  assert.doesNotMatch(migration, /before update on public\.bgm_membership_applications/);
  assert.match(migration, /new\.base_price_cents := v_amount_cents/);
});
