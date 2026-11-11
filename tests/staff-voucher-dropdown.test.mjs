import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const optionsRoute = read("app/api/system/members/active-vouchers/route.ts");
const dropdown = read("components/staff/StaffVoucherSelect.tsx");
const modal = read("components/staff/StaffMembershipReviewModal.tsx");
const pending = read("components/staff/PendingMembershipActions.tsx");
const discountPreview = read("app/api/system/members/applications/[applicationId]/discount/route.ts");
const activation = read("app/api/system/members/enroll/route.ts");
const endOfDay = read("lib/endOfDayCore.ts");

test("voucher options are authorized, read-only and reflect current validity", () => {
  assert.match(optionsRoute, /export async function GET/);
  assert.doesNotMatch(optionsRoute, /export async function POST/);
  assert.match(optionsRoute, /requireSystemPermission\(request, "membership\.activate"\)/);
  assert.match(optionsRoute, /from\("bgm_discount_codes"\)/);
  assert.match(optionsRoute, /\.eq\("active", true\)/);
  assert.match(optionsRoute, /todayMaltaDate\(\)/);
  assert.match(optionsRoute, /voucher\.valid_from <= today/);
  assert.match(optionsRoute, /voucher\.valid_until >= today/);
  assert.match(optionsRoute, /voucher\.successful_uses < voucher\.max_uses/);
  assert.match(optionsRoute, /\.map\(\(\{ code, percentage \}\) => \(\{ code, percentage \}\)\)/);
  assert.doesNotMatch(optionsRoute, /\.(?:insert|update|upsert|delete|rpc)\(/);
});

test("dropdown defaults to No voucher and passes the exact existing code", () => {
  assert.match(dropdown, /<option value="">No voucher<\/option>/);
  assert.match(dropdown, /value=\{voucher\.code\}/);
  assert.match(dropdown, /onChange\(event\.target\.value\)/);
  assert.match(dropdown, /cache: "no-store"/);
  assert.match(dropdown, /onFocus=\{\(\) => void loadVouchers\(\)\}/);
  assert.doesNotMatch(dropdown, /(?:price|reimbursement|discountAmountCents)\s*=/);
});

test("both staff payment surfaces only replace code entry with voucher selection", () => {
  for (const ui of [modal, pending]) {
    assert.match(ui, /import StaffVoucherSelect/);
    assert.match(ui, /<StaffVoucherSelect/);
    assert.match(ui, /Apply code/);
    assert.match(ui, /Discount code/);
    assert.match(ui, /Base Price/);
    assert.match(ui, /Final Total/);
    assert.match(ui, /PAYMENT RECEIVED/);
    assert.doesNotMatch(ui, /placeholder="Enter Super Admin code"/);
  }
  assert.match(modal, /setDiscountPreview\(null\)/);
  assert.match(pending, /delete next\[application\.id\]/);
});

test("unchanged server validation, activation and EOD reimbursement paths remain authoritative", () => {
  assert.match(discountPreview, /requireSystemPermission\(request,\s*"membership\.activate"\)/);
  assert.match(discountPreview, /discountAmountCents\(basePriceCents, discount\.percentage\)/);
  assert.match(discountPreview, /discount\.max_uses !== null/);
  assert.match(activation, /p_discount_code: discountCode \|\| null/);
  assert.match(endOfDay, /row\.discountReimbursementCentsSnapshot/);
  assert.match(endOfDay, /memberships\.cardCents \+= reimbursement/);
  assert.match(endOfDay, /voucherReimbursementCents \+= reimbursement/);
  assert.match(endOfDay, /row\.discountCodeSnapshot/);
});
