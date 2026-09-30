import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("renewal screen preserves authenticated Super Admin identity when pricing configuration fails", () => {
  const ui = read("components/staff/StaffRenewalEnrollmentPage.tsx");
  const authAssignment = ui.indexOf("setUser(authenticatedUser)");
  const pricingFailure = ui.indexOf("if (!pricingResponse.ok || !Array.isArray(pricingData.entries))");
  assert.ok(authAssignment >= 0, "authenticated user must be stored");
  assert.ok(pricingFailure > authAssignment, "pricing failure must not erase a valid system session");
  assert.match(ui, /System login required/);
  assert.match(ui, /Gym Staff or Super Admin account/);
});

test("explicit production-safe membership price publication migration requires the 21-slot catalog", () => {
  const sql = read("supabase/migrations/20260930_081500_fix_membership_price_catalog_publish_count.sql");
  assert.match(sql, /create or replace function public\.bgm_publish_membership_price_catalog/);
  assert.match(sql, /v_entry_count <> 21/);
  assert.match(sql, /exactly 21 entries/);
  assert.doesNotMatch(sql, /replace\s*\(/i);
});
