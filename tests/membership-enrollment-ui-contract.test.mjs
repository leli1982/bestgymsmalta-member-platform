import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const componentUrl = new URL(
  "../components/staff/MembershipEnrollmentPage.tsx",
  import.meta.url
);
const pageUrl = new URL("../app/staff/members/enroll/page.tsx", import.meta.url);
const staffHomeUrl = new URL("../components/staff/StaffLoginPage.tsx", import.meta.url);

function read(url) {
  return fs.readFileSync(url, "utf8");
}

test("membership tools start with explicit NEW MEMBERSHIP and RENEWAL choices", () => {
  const source = read(componentUrl);
  assert.match(source, /NEW MEMBERSHIP/);
  assert.match(source, /RENEWAL/);
  assert.match(source, /\/api\/system\/members\/enroll/);
});

test("both application flows visibly require Staff Name for human accountability", () => {
  const source = read(componentUrl);
  assert.match(source, /Staff Name/);
  assert.match(source, /staffName/);
  assert.match(source, /required/);
  assert.match(source, /NEW MEMBERSHIP[\s\S]*Staff Name/i);
  assert.match(source, /RENEWAL[\s\S]*Staff Name/i);
});

test("renewal searches and confirms a permanent member before continuing", () => {
  const source = read(componentUrl);
  assert.match(source, /\/api\/system\/members\/search/);
  assert.match(source, /This number and barcode stay with this member\./);
  assert.match(source, /memberNumber/);
});

test("printing is separate from payment activation and Activation Staff Name is required", () => {
  const source = read(componentUrl);
  assert.match(source, /Print Application/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /Printing does not activate/i);
  assert.match(source, /Activation Staff Name/);
  assert.match(source, /activationStaffName/);
  assert.match(source, /PAYMENT RECEIVED — ACTIVATE/);
});

test("staff enrollment route renders the membership enrollment component", () => {
  const source = read(pageUrl);
  assert.match(source, /MembershipEnrollmentPage/);
});

test("staff Members tile navigates to membership enrollment tools", () => {
  const source = read(staffHomeUrl);
  assert.match(source, /title=["']Members["']/);
  assert.match(source, /href=["']\/staff\/members\/enroll["']/);
  assert.match(source, /members\.create/);
  assert.match(source, /members\.renew/);
});
