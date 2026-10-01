import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/system/voucher-analytics/route.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../components/staff/StatisticsDashboardAdmin.tsx", import.meta.url), "utf8");
const vouchers = readFileSync(new URL("../components/staff/VoucherAnalyticsAdmin.tsx", import.meta.url), "utf8");
const print = readFileSync(new URL("../components/staff/VoucherReportPrint.tsx", import.meta.url), "utf8");

test("Super Admin voucher analytics include all configured percentages and historical snapshots", () => {
  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /bgm_discount_codes/);
  assert.doesNotMatch(route, /\.eq\(["']percentage["'],\s*100\)/);
  assert.doesNotMatch(route, /\.eq\(["']discount_percentage_snapshot["'],\s*100\)/);
  assert.match(route, /discount_code_snapshot/);
  assert.match(route, /discount_percentage_snapshot/);
  assert.match(route, /bgm_membership_application_members/);
  assert.match(route, /id_number/);
  assert.match(route, /enrollment_gym_id/);
  assert.match(route, /effectiveStatus/);
  assert.match(route, /Removed from settings/);
});

test("Statistics dashboard exposes Vouchers as a detailed report", () => {
  assert.match(dashboard, /key:\s*["']vouchers["']/);
  assert.match(dashboard, /label:\s*["']Vouchers["']/);
  assert.match(dashboard, /<VoucherAnalyticsAdmin\s*\/>/);
});

test("Voucher UI supports search, active inactive status, date filters and selected/all printing", () => {
  assert.match(vouchers, /Search voucher name/);
  assert.match(vouchers, /Active only/);
  assert.match(vouchers, /Inactive only/);
  assert.match(vouchers, /EuropeanDateInput/);
  assert.match(vouchers, /Print selected voucher/);
  assert.match(vouchers, /Print all vouchers/);
  assert.match(vouchers, /Discount/);
  assert.match(vouchers, /voucher\.percentage/);
  for (const label of ["Name", "Surname", "ID Number", "Enrollment Date", "Gym", "Voucher"]) {
    assert.match(vouchers, new RegExp(label));
  }
});

test("Voucher print view is A4/PDF friendly and prints each voucher with employee detail", () => {
  assert.match(print, /@page \{ size: A4 portrait/);
  assert.match(print, /window\.print\(\)/);
  assert.match(print, /Print \/ Save PDF/);
  assert.match(print, /Voucher Report/);
  assert.match(print, /item\.percentage/);
  assert.match(print, /voucher-section/);
  assert.match(print, /voucher-members/);
});
