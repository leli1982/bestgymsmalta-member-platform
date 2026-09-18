import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const componentUrl = new URL(
  "../components/staff/MembershipEnrollmentPage.tsx",
  import.meta.url
);
const renewalUrl = new URL(
  "../components/staff/StaffRenewalEnrollmentPage.tsx",
  import.meta.url
);
const registrationRouteUrl = new URL(
  "../app/api/system/members/registration/route.ts",
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

test("membership tools keep explicit direct New Member and Renew choices", () => {
  const dashboard = read(staffDashboardUrl);
  const wrapper = read(componentUrl);
  assert.match(dashboard, /label=["']New Member["']/);
  assert.match(dashboard, /label=["']Renew["']/);
  assert.match(dashboard, /kind=new/);
  assert.match(dashboard, /kind=renewal/);
  assert.match(wrapper, /StaffRenewalEnrollmentPage/);
  assert.match(wrapper, /RegistrationForm/);
});

test("new registration attributes staff accountability to the authenticated system user", () => {
  const route = read(registrationRouteUrl);
  const renewal = read(renewalUrl);
  assert.match(route, /requireSystemPermission[\s\S]*members\.create/);
  assert.match(route, /displayName/);
  assert.match(route, /staff_name/);
  assert.match(route, /membership\.application\.submit/);
  assert.match(renewal, /Staff Name/);
  assert.match(renewal, /staffName/);
});

test("renewal keeps the permanent member number while allowing card keep or replacement", () => {
  const renewal = read(renewalUrl);
  const cardAssign = read(cardAssignUrl);
  assert.match(renewal, /\/api\/system\/members\/search/);
  assert.match(renewal, /permanent member number/i);
  assert.match(renewal, /memberNumber/);
  assert.match(cardAssign, /renewalCardAction\s*=\s*["']keep["']/);
  assert.match(cardAssign, /renewalCardAction\s*=\s*["']replace["']/);
});

test("legacy renewal printing remains separate from payment activation", () => {
  const renewal = read(renewalUrl);
  assert.match(renewal, /Print Application/);
  assert.match(renewal, /window\.print\(\)/);
  assert.match(renewal, /Printing does not activate/i);
  assert.match(renewal, /Activation Staff Name/);
  assert.match(renewal, /activationStaffName/);
  assert.match(renewal, /PAYMENT RECEIVED — ACTIVATE/);
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
