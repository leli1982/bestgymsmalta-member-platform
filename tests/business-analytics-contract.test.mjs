import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/system/business-analytics/route.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../components/staff/StatisticsDashboardAdmin.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/staff/SuperAdminHome.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("../components/staff/OperationsDashboardAdmin.tsx", import.meta.url), "utf8");

test("business analytics route covers retention revenue usage engagement and trends", () => {
  assert.match(route, /retention:/);
  assert.match(route, /revenue:/);
  assert.match(route, /usage:/);
  assert.match(route, /engagement:/);
  assert.match(route, /trends:/);
  assert.match(route, /reactivationsAfter30Days/);
  assert.match(route, /crossGymPct/);
  assert.match(route, /inactive90/);
  assert.match(route, /averageValueCents/);
});

test("statistics dashboard exposes button-driven analytics and existing reports", () => {
  for (const label of [
    "Overview",
    "Membership trends",
    "Retention & churn",
    "Revenue & discounts",
    "Gym usage",
    "Member activity",
    "Busy periods",
    "New memberships",
    "Active members by gym",
    "Check-in statistics",
  ]) assert.match(dashboard, new RegExp(label.replace(/[&]/g, "\\&")));
});

test("Super Admin links to dedicated statistics page and Operations no longer embeds all reports", () => {
  assert.match(home, /\/staff\/admin\/statistics/);
  assert.doesNotMatch(operations, /<MembershipStatsAdmin/);
  assert.doesNotMatch(operations, /<ActiveMembersByGymAdmin/);
  assert.doesNotMatch(operations, /<ScanVisitStatsAdmin/);
});
