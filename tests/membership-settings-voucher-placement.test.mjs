import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync("components/staff/MembershipSettingsAdmin.tsx", "utf8");
const pageSource = readFileSync("app/staff/membership-settings/page.tsx", "utf8");

test("voucher reimbursement editor sits between discount vouchers and declarations", () => {
  assert.match(settingsSource, /import VoucherReimbursementAdmin from \"@\/components\/staff\/VoucherReimbursementAdmin\";/);

  const discountListIndex = settingsSource.indexOf("No discount codes yet.");
  const voucherValueIndex = settingsSource.indexOf("<VoucherReimbursementAdmin");
  const declarationsIndex = settingsSource.indexOf('id="rules-declarations"');

  assert.ok(discountListIndex >= 0, "discount voucher section should exist");
  assert.ok(voucherValueIndex > discountListIndex, "Voucher Value € must appear after the voucher section");
  assert.ok(declarationsIndex > voucherValueIndex, "Voucher Value € must appear before Rules & Declarations");

  assert.doesNotMatch(pageSource, /VoucherReimbursementAdmin/,
    "page wrapper must not render the voucher value editor again at the bottom");
});
