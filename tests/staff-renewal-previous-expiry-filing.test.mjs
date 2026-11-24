import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const renewal = read("components/staff/StaffRenewalEnrollmentPage.tsx");
const enroll = read("app/api/system/members/enroll/route.ts");
const migration = read("supabase/migrations/20261124_090000_renewal_previous_expiry_filing_snapshot.sql");
const reviewLoader = read("app/api/system/members/applications/[applicationId]/route.ts");
const review = read("components/staff/StaffMembershipReviewModal.tsx");
const printLoader = read("lib/printableMembershipApplication.ts");
const print = read("components/staff/MembershipA4Sheet.tsx");

test("previous expiry appears only for staff renewals and auto-fills but stays editable", () => {
  assert.match(renewal, /previousExpiryDate: candidate\.membershipExpiry \|\| ""/);
  assert.match(renewal, /kind === "renewal" && \(/);
  assert.match(renewal, /<Field label="Previous Exp Date">/);
  assert.match(renewal, /onValueChange=\{\(value\) => onChange\(index, "previousExpiryDate", value\)\}/);
  assert.match(renewal, /previousExpiryDate: ""/);
  assert.doesNotMatch(renewal, /previousExpiryDate.*required/);
});

test("previous expiry is an optional validated filing snapshot, not an entitlement date", () => {
  assert.match(enroll, /kind === "renewal" && previousExpiryDate && !isIsoDate\(previousExpiryDate\)/);
  assert.match(enroll, /previous_expiry_date: kind === "renewal" \? \(previousExpiryDate \|\| null\) : null/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS previous_expiry_date date/);
  assert.match(migration, /not used to calculate or change entitlement/);
  assert.match(enroll, /const latestActiveExpiry = activeExpiries\.at\(-1\)/);
  assert.match(enroll, /const requiredStartDate = addOneDayIso\(latestActiveExpiry\)/);
});

test("review and A4 printing show each member's filed previous expiry on renewals only", () => {
  assert.match(reviewLoader, /previous_expiry_date, first_name/);
  assert.match(reviewLoader, /previousExpiryDate: application\.application_kind === "renewal"/);
  assert.match(review, /application\.kind === "renewal" && \(/);
  assert.match(review, /<strong>Previous Exp Date:<\/strong>/);
  assert.match(printLoader, /previous_expiry_date, first_name/);
  assert.match(printLoader, /previousExpiryDate: application\.application_kind === "renewal"/);
  assert.match(print, /application\.kind === "renewal"\s*\? <Info label="Previous Exp Date"/);
  assert.match(print, /<Info label="Status"/);
});
