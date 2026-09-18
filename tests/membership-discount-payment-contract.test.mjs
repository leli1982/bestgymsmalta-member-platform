import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function read(path) {
  try { return readFileSync(join(root, path), "utf8"); } catch { return ""; }
}

const discountRoute = read("app/api/system/members/applications/[applicationId]/discount/route.ts");
const enrollRoute = read("app/api/system/members/enroll/route.ts");
const modal = read("components/staff/StaffMembershipReviewModal.tsx");
const pending = read("components/staff/PendingMembershipActions.tsx");
const migration = read("supabase/migrations/20260918_090000_membership_discount_payment.sql");
const settingsRoute = read("app/api/system/membership-settings/route.ts");

test("membership rates and discount definitions remain Super Admin only", () => {
  assert.match(settingsRoute, /requireSuperAdmin\(request\)/);
  assert.match(settingsRoute, /save_price_draft/);
  assert.match(settingsRoute, /publish_price_catalog/);
  assert.match(settingsRoute, /save_discount_code/);
  assert.match(settingsRoute, /set_discount_active/);

  assert.match(migration, /bgm_enforce_membership_application_price_snapshot/i);
  assert.match(migration, /bgm_membership_price_catalog_versions/i);
  assert.match(migration, /status\s*=\s*'published'/i);
  assert.match(migration, /bgm_membership_price_entries/i);
  assert.match(migration, /new\.base_price_cents\s*:=\s*v_amount_cents/i);
  assert.match(migration, /new\.price_catalog_version_id\s*:=\s*v_catalog_version_id/i);
});

test("staff discount preview accepts a code only and derives all values server-side", () => {
  assert.match(discountRoute, /requireSystemPermission\(request,\s*["']membership\.activate["']\)/);
  assert.match(discountRoute, /const\s+code\s*=\s*normalizeDiscountCode/);
  assert.match(discountRoute, /base_price_cents/);
  assert.match(discountRoute, /bgm_discount_codes/);
  assert.match(discountRoute, /percentage/);
  assert.match(discountRoute, /successful_uses/);
  assert.match(discountRoute, /discountAmountCents/);
  assert.match(discountRoute, /finalAmountCents/);
  assert.doesNotMatch(discountRoute, /body\.(?:percentage|basePriceCents|discountAmountCents|finalAmountCents)/);
  assert.doesNotMatch(discountRoute, /\.update\([^)]*successful_uses|successful_uses\s*\+/s);
});

test("activation accepts payment details and discount code but never client price or percentage values", () => {
  assert.match(enrollRoute, /paymentMethod/);
  assert.match(enrollRoute, /paymentOtherText/);
  assert.match(enrollRoute, /staffName/);
  assert.match(enrollRoute, /discountCode/);
  assert.match(enrollRoute, /bgm_activate_membership_application/);
  assert.match(enrollRoute, /p_payment_method/);
  assert.match(enrollRoute, /p_discount_code/);
  assert.doesNotMatch(enrollRoute, /body\.(?:percentage|basePriceCents|discountAmountCents|finalAmountCents)/);
});

test("activation RPC rechecks Super Admin price snapshot and discount code atomically", () => {
  assert.match(migration, /create or replace function public\.bgm_activate_membership_application/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /price_catalog_version_id/i);
  assert.match(migration, /bgm_membership_price_entries/i);
  assert.match(migration, /base_price_cents/i);
  assert.match(migration, /bgm_discount_codes/i);
  assert.match(migration, /successful_uses\s*=\s*successful_uses\s*\+\s*1/i);
  assert.match(migration, /payment_method/i);
  assert.match(migration, /payment_other_text/i);
  assert.match(migration, /payment_staff_name/i);
  assert.match(migration, /membership\.activate/i);
  assert.match(migration, /revoke all on function public\.bgm_activate_membership_application[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.bgm_activate_membership_application[\s\S]*to service_role/i);
});

test("staff payment UI only asks for code and payment method and displays calculated totals", () => {
  for (const source of [modal, pending]) {
    assert.match(source, /Discount code/i);
    assert.match(source, /Apply code/i);
    assert.match(source, /Base Price/);
    assert.match(source, /Discount/);
    assert.match(source, /Final Total/);
    assert.match(source, /Cash/);
    assert.match(source, /Card/);
    assert.match(source, /Other/);
    assert.doesNotMatch(source, /Discount percentage[^\n]*<input/i);
    assert.doesNotMatch(source, /Base Price[^\n]*<input/i);
    assert.doesNotMatch(source, /Final Total[^\n]*<input/i);
  }
});
