import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

const dashboard = read("components/staff/StaffDashboard.tsx");
const browser = read("components/staff/StaffMemberBrowser.tsx");
const login = read("components/staff/StaffLoginPage.tsx");
const queue = read("components/staff/StaffMembershipQueue.tsx");
const modal = read("components/staff/StaffMembershipReviewModal.tsx");
const printRoute = read("app/api/system/members/applications/[applicationId]/print/route.ts");
const printPage = read("app/staff/applications/[applicationId]/print/page.tsx");
const printView = read("components/staff/StaffApplicationPrint.tsx");
const printSheet = read("components/staff/MembershipA4Sheet.tsx");

test("staff login preserves existing auth endpoints and hands authenticated users to StaffDashboard", () => {
  assert.match(login, /fetch\(["']\/api\/system\/auth["']/);
  assert.match(login, /method:\s*["']POST["']/);
  assert.match(login, /method:\s*["']DELETE["']/);
  assert.match(login, /<StaffDashboard\s+user=\{user\}\s+onLogout=\{logout\}/);
});

test("staff dashboard is icon-first and exposes core reception actions", () => {
  for (const label of ["Members", "New Member", "Renew", "Waiting", "Reception Tools", "Sundries", "Bar"]) {
    assert.match(dashboard, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(dashboard, /lucide-react/);
  assert.match(dashboard, /#ff5a0a/i);
  assert.match(dashboard, /Realtime|connection/i);
  assert.match(dashboard, /WAITING/);
  assert.match(dashboard, /membersOpen/);
  assert.match(dashboard, /href=["']\/staff\/members\/enroll\?kind=new["']/);
  assert.match(dashboard, /href=["']\/staff\/members\/enroll\?kind=renewal["']/);
  assert.doesNotMatch(dashboard, /membershipActionOpen/);
  assert.doesNotMatch(dashboard, /gym selector/i);
});

test("member browser exposes browse search and All Active Expired filters", () => {
  assert.match(browser, /\/api\/system\/members\/search/);
  assert.match(browser, /\{\s*key:\s*["']all["'],\s*label:\s*["']ALL["']\s*\}/);
  assert.match(browser, /\{\s*key:\s*["']active["'],\s*label:\s*["']ACTIVE["']\s*\}/);
  assert.match(browser, /\{\s*key:\s*["']expired["'],\s*label:\s*["']EXPIRED["']\s*\}/);
  assert.match(browser, /AbortController/);
  assert.match(browser, /member number|ID number|phone|email/i);
  assert.match(browser, /pkCustomer/i);
});

test("member browser keeps profile fields read-only while exposing canonical status labels and controlled renewal", () => {
  assert.match(browser, /ACTIVE/);
  assert.match(browser, /EXPIRED/);
  assert.match(browser, /INACTIVE/);
  assert.doesNotMatch(browser, /Save Member|Update Member|Delete Member/);
  assert.match(browser, /canRenew/);
  assert.match(browser, /RENEW MEMBERSHIP/);
  assert.match(browser, /Physical card \/ pkCustomer/);
  assert.match(browser, /legacyGym\s*\|\|\s*selected\.enrollmentGymName/);
});

test("new membership queue exposes waiting state and recoverable refreshes", () => {
  assert.match(queue, /WAITING/);
  assert.match(queue, /submittedAt/);
  assert.match(queue, /\/api\/system\/members\/applications/);
  assert.match(queue, /online/);
  assert.match(queue, /setInterval/);
  assert.match(queue, /Retry/);
});

test("review modal keeps the approved three primary actions", () => {
  assert.match(modal, /SCAN CARD/);
  assert.match(modal, /PAYMENT RECEIVED/);
  assert.match(modal, /PRINT FORM/);
  assert.doesNotMatch(modal, /ACTIVATE MEMBER/);
});

test("scan card mode includes a secondary manual entry fallback and preserves card conflicts", () => {
  assert.match(modal, /manual/i);
  assert.match(modal, /applicationMemberId/);
  assert.match(modal, /\/api\/system\/members\/card\/assign/);
  assert.match(modal, /409|conflict|already/i);
});

test("payment received activates only after prerequisites and asks for controlled payment data", () => {
  assert.match(modal, /staffName/);
  assert.match(modal, /Payment Staff Name/);
  assert.match(modal, /paymentMethod/);
  assert.match(modal, /discountCode/);
  assert.match(modal, /action:\s*["']activate["']/);
  assert.match(modal, /MEMBERSHIP ACTIVE/);
  assert.match(modal, /hasPhoto/);
  assert.match(modal, /cardVerified|reservedBarcode/);
});

test("print endpoint is authenticated gym-scoped and audits print requests", () => {
  assert.match(printRoute, /requireSystemPermission/);
  assert.match(printRoute, /enrollment_gym_id/);
  assert.match(printRoute, /context\.gymId/);
  assert.match(printRoute, /membership\.application\.print_requested/);
});

test("print surface renders one dedicated A4 member sheet with signatures and final membership details", () => {
  assert.match(printPage, /StaffApplicationPrint/);
  assert.match(printView, /MembershipA4Sheet/);
  assert.match(printView, /application\.participants\.map/);
  assert.match(printSheet, /@page/);
  assert.match(printSheet, /A4 portrait/);
  assert.match(printSheet, /Member Signature/);
  assert.match(printSheet, /Staff Signature/);
  assert.match(printView, /window\.print/);
  assert.match(printSheet, /applicationReference|Application reference/);
});


test("member search API resolves enrollment gym names for the member popup", () => {
  const route = read("app/api/system/members/search/route.ts");
  assert.match(route, /bgm_gyms/);
  assert.match(route, /enrollmentGymName/);
  assert.match(route, /enrollment_gym_id/);
});


test("staff login username and password inputs always use readable dark-field styling", () => {
  assert.match(login, /bg-zinc-900/);
  assert.match(login, /text-white/);
  assert.match(login, /placeholder:text-zinc-400/);
  assert.match(login, /caret-white/);
});


test("member detail popup gives the member photo strong visual priority", () => {
  assert.match(browser, /sm:h-56/);
  assert.match(browser, /sm:w-56/);
  assert.match(browser, /max-w-2xl/);
});
