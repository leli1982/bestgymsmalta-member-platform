import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function read(path) {
  try { return readFileSync(join(root, path), "utf8"); } catch { return ""; }
}

const printShell = read("components/staff/StaffApplicationPrint.tsx");
const sheet = read("components/staff/MembershipA4Sheet.tsx");
const overflow = read("components/staff/MembershipPrintOverflowPreview.tsx");
const printRoute = read("app/api/system/members/applications/[applicationId]/print/route.ts");
const settings = read("components/staff/MembershipSettingsAdmin.tsx");
const browser = read("tests/browser/membership-print-a4.mjs");
const workflow = read(".github/workflows/phase2-ci.yml");

test("print CSS enforces exactly one A4 portrait sheet per participant", () => {
  assert.match(sheet, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*8mm;\s*\}/);
  assert.match(sheet, /\.bgm-member-a4-sheet\s*\{[^}]*width:\s*194mm;[^}]*height:\s*281mm;[^}]*overflow:\s*hidden;[^}]*break-after:\s*page;/s);
  assert.match(sheet, /\.bgm-member-a4-sheet:last-child\s*\{\s*break-after:\s*auto;/);
  assert.match(printShell, /application\.participants\.map/);
  assert.match(printShell, /<MembershipA4Sheet/);
  assert.doesNotMatch(sheet, /participants\.map/);
});

test("each member sheet is standalone and uses historical application snapshots", () => {
  for (const label of [
    "Application reference",
    "Member number",
    "Card number",
    "Membership type",
    "Duration",
    "Start date",
    "Expiry date",
    "Base price",
    "Discount",
    "Final total",
    "Payment method",
    "Payment staff",
    "Verification",
    "Gym Rules",
    "Privacy",
    "Health",
    "Member Signature",
    "Staff Signature",
  ]) assert.match(sheet, new RegExp(label, "i"));

  assert.match(sheet, /guardian/i);
  assert.match(sheet, /declarationSnapshot/);
  assert.match(printRoute, /declaration_snapshot/);
  assert.match(printRoute, /base_price_cents/);
  assert.match(printRoute, /discount_amount_cents/);
  assert.match(printRoute, /final_amount_cents/);
  assert.match(printRoute, /payment_method/);
  assert.match(printRoute, /payment_staff_name/);
  assert.match(printRoute, /id_verified_at/);
  assert.match(printRoute, /student_eligibility_verified_at/);
  assert.match(printRoute, /guardian_present_verified_at/);
  assert.match(printRoute, /guardian_cosign_verified_at/);
});

test("print route resolves allocated member and card numbers after activation", () => {
  assert.match(printRoute, /bgm_membership_members/);
  assert.match(printRoute, /member_number/);
  assert.match(printRoute, /bgm_member_card_credentials/);
  assert.match(printRoute, /memberRole|member_role/);
});

test("Super Admin declaration publishing has an A4 overflow measurement gate", () => {
  assert.match(overflow, /scrollHeight/);
  assert.match(overflow, /clientHeight/);
  assert.match(overflow, /fits/);
  assert.match(overflow, /measuredHeightPx/);
  assert.match(overflow, /maxHeightPx/);
  assert.match(settings, /MembershipPrintOverflowPreview/);
  assert.match(settings, /This wording will overflow the one-page A4 membership form/);
  assert.match(settings, /disabled=\{[^}]*printOverflow/i);
});

test("Chromium verifies Single, Student minor and Couples print fit", () => {
  assert.match(browser, /single/i);
  assert.match(browser, /student/i);
  assert.match(browser, /couples/i);
  assert.match(browser, /\.bgm-member-a4-sheet/);
  assert.match(browser, /scrollHeight/);
  assert.match(browser, /clientHeight/);
  assert.match(browser, /length,\s*2/);
  assert.match(workflow, /membership-print-a4\.mjs/);
});
