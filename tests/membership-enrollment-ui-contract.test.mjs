import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const componentUrl = new URL(
  "../components/staff/MembershipEnrollmentPage.tsx",
  import.meta.url
);
const pageUrl = new URL("../app/staff/members/enroll/page.tsx", import.meta.url);
const staffDashboardUrl = new URL("../components/staff/StaffDashboard.tsx", import.meta.url);
const staffQueueUrl = new URL("../components/staff/StaffMembershipQueue.tsx", import.meta.url);
const staffBrowserUrl = new URL("../components/staff/StaffMemberBrowser.tsx", import.meta.url);
const cardAssignUrl = new URL("../app/api/system/members/card/assign/route.ts", import.meta.url);

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

test("renewal keeps the permanent member number while allowing card keep or replacement", () => {
  const source = read(componentUrl);
  const cardAssign = read(cardAssignUrl);
  assert.match(source, /\/api\/system\/members\/search/);
  assert.match(source, /permanent member number/i);
  assert.match(source, /memberNumber/);
  assert.match(cardAssign, /renewalCardAction\s*=\s*["']keep["']/);
  assert.match(cardAssign, /renewalCardAction\s*=\s*["']replace["']/);
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

test("staff enrollment route wraps the search-param client component in Suspense", () => {
  const source = read(pageUrl);
  assert.match(source, /import\s+\{\s*Suspense\s*\}\s+from\s+["']react["']/);
  assert.match(source, /<Suspense[\s\S]*<MembershipEnrollmentPage\s*\/>[\s\S]*<\/Suspense>/);
});

test("staff dashboard separates established-member browsing from the new-member waiting workflow", () => {
  const dashboard = read(staffDashboardUrl);
  const queue = read(staffQueueUrl);
  const browser = read(staffBrowserUrl);
  assert.match(dashboard, /label=["']Members["']/);
  assert.match(dashboard, /label=["']New Member["']/);
  assert.match(dashboard, /StaffMemberBrowser/);
  assert.match(dashboard, /StaffMembershipQueue/);
  assert.match(browser, /\/api\/system\/members\/search/);
  assert.match(queue, /\/api\/system\/members\/applications/);
});
