import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync("components/staff/MembershipSettingsAdmin.tsx", "utf8");
const voucherSource = readFileSync("components/staff/VoucherReimbursementAdmin.tsx", "utf8");
const pageSource = readFileSync("app/staff/membership-settings/page.tsx", "utf8");

test("voucher reimbursement editor mounts immediately before declarations", () => {
  assert.match(settingsSource, /id="rules-declarations"/);
  assert.match(pageSource, /<VoucherReimbursementAdmin \/>/,
    "Membership Settings page should include the voucher value editor");
  assert.match(voucherSource, /document\.getElementById\("rules-declarations"\)/);
  assert.match(voucherSource, /parent\.insertBefore\(host, declarations\)/);
  assert.match(voucherSource, /createPortal\(content, portalHost\)/);
});
