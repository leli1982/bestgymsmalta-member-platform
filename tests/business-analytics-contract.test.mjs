import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/system/business-analytics/route.ts", import.meta.url), "utf8");
const appAdoptionRoute = readFileSync(new URL("../app/api/system/app-adoption-analytics/route.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../components/staff/StatisticsDashboardAdmin.tsx", import.meta.url), "utf8");
const appAdoption = readFileSync(new URL("../components/staff/AppAdoptionAnalyticsAdmin.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/staff/SuperAdminHome.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("../components/staff/OperationsDashboardAdmin.tsx", import.meta.url), "utf8");

test("business analytics route keeps existing retention revenue usage engagement and trends", () => {
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

test("app adoption analytics is read-only, Super Admin protected and uses existing enrollment fields", () => {
  assert.match(appAdoptionRoute, /requireSuperAdmin/);
  assert.match(appAdoptionRoute, /\.from\("bgm_members"\)/);
  assert.match(appAdoptionRoute, /app_enrolled/);
  assert.match(appAdoptionRoute, /enrollment_date/);
  assert.match(appAdoptionRoute, /totalEnrolled/);
  assert.match(appAdoptionRoute, /activeEnrolled/);
  assert.match(appAdoptionRoute, /adoptionPct/);
  assert.match(appAdoptionRoute, /notEnrolledActive/);
  assert.match(appAdoptionRoute, /activatedToday/);
  assert.match(appAdoptionRoute, /activatedThisWeek/);
  assert.match(appAdoptionRoute, /activatedThisMonth/);
  assert.match(appAdoptionRoute, /daily/);
  assert.doesNotMatch(appAdoptionRoute, /\.insert\(/);
  assert.doesNotMatch(appAdoptionRoute, /\.update\(/);
  assert.doesNotMatch(appAdoptionRoute, /\.delete\(/);
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
    "App Adoption",
    "New memberships",
    "Active members by gym",
    "Check-in statistics",
    "Vouchers",
  ]) assert.match(dashboard, new RegExp(label.replace(/[&]/g, "\\&")));
  assert.match(dashboard, /<AppAdoptionAnalyticsAdmin/);
});

test("App Adoption renders the required headline KPIs and daily activation trend", () => {
  for (const label of [
    "Total enrolled",
    "Adoption rate",
    "Activated today",
    "Activated this week",
    "Activated this month",
    "Active not enrolled",
    "Daily app activations",
  ]) assert.match(appAdoption, new RegExp(label));
  assert.match(appAdoption, /\/api\/system\/app-adoption-analytics/);
});

test("Super Admin links to dedicated statistics page and Operations no longer embeds all reports", () => {
  assert.match(home, /\/staff\/admin\/statistics/);
  assert.doesNotMatch(operations, /<MembershipStatsAdmin/);
  assert.doesNotMatch(operations, /<ActiveMembersByGymAdmin/);
  assert.doesNotMatch(operations, /<ScanVisitStatsAdmin/);
});
