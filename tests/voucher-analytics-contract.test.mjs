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

test("voucher attendance is derived from canonical staffed check-ins and real membership identities", () => {
  assert.match(route, /bgm_memberships/);
  assert.match(route, /bgm_membership_members/);
  assert.match(route, /bgm_members/);
  assert.match(route, /member_number/);
  assert.match(route, /bgm_member_checkins/);
  assert.match(route, /\.in\(["']source["'],\s*\[["']barcode["'],\s*["']nfc["']\]\)/);
  assert.match(route, /summariseVoucherAttendance/);
  assert.match(route, /attendancePercentage/);
  assert.match(route, /totalVisits/);
  assert.match(route, /gymBreakdown/);
  assert.match(route, /eligibleDays/);
  assert.match(route, /attendedDays/);
  assert.match(route, /missedDays/);
  assert.match(route, /attendanceStatus/);
});

test("voucher attendance uses membership overlap rather than enrollment date and honors effective cancellation", () => {
  assert.match(route, /start_date/);
  assert.match(route, /expiry_date/);
  assert.match(route, /cancellation_effective_date/);
  assert.match(route, /application_id/);
  assert.match(route, /previousCalendarDate/);
  assert.doesNotMatch(route, /\.gte\(["']activated_at["'],\s*start\)\s*\.lt\(["']activated_at["'],\s*end\)/);
});

test("voucher attendance check-ins are paged across the full selected period", () => {
  assert.match(route, /allRows<[^>]*CheckinRow/);
  assert.match(route, /\.gte\(["']checkin_at["'],\s*start\)/);
  assert.match(route, /\.lt\(["']checkin_at["'],\s*end\)/);
});

test("Statistics dashboard exposes Vouchers as a detailed report", () => {
  assert.match(dashboard, /key:\s*["']vouchers["']/);
  assert.match(dashboard, /label:\s*["']Vouchers["']/);
  assert.match(dashboard, /<VoucherAnalyticsAdmin\s*\/>/);
});

test("Voucher UI supports search, voucher status, attendance filtering and compliance detail", () => {
  assert.match(vouchers, /Search voucher name/);
  assert.match(vouchers, /Active only/);
  assert.match(vouchers, /Inactive only/);
  assert.match(vouchers, /EuropeanDateInput/);
  assert.match(vouchers, /Print selected voucher/);
  assert.match(vouchers, /Print all vouchers/);
  assert.match(vouchers, /Discount/);
  assert.match(vouchers, /Maximum successful uses/);
  assert.match(vouchers, /voucher\.maxUses === null \? "N\/A"/);
  assert.match(vouchers, /voucher\.percentage/);
  assert.match(vouchers, /No Show/);
  assert.match(vouchers, /Attending/);
  assert.match(vouchers, /Historical \/ Unlinked/);
  assert.match(vouchers, /Attendance %/);
  assert.match(vouchers, /Eligible Days/);
  assert.match(vouchers, /Attended Days/);
  assert.match(vouchers, /Missed Days/);
  assert.match(vouchers, /Total Visits/);
  assert.match(vouchers, /Gym Breakdown/);
  assert.match(vouchers, /Missed dates/);
  for (const label of ["Name", "Surname", "ID Number", "Enrollment Date", "Gym", "Voucher"]) {
    assert.match(vouchers, new RegExp(label));
  }
});

test("Voucher print view is A4/PDF friendly and carries attendance filter/detail", () => {
  assert.match(print, /@page \{ size: A4 portrait/);
  assert.match(print, /window\.print\(\)/);
  assert.match(print, /Print \/ Save PDF/);
  assert.match(print, /Voucher Attendance Compliance Report/);
  assert.match(print, /item\.percentage/);
  assert.match(print, /maximum successful uses/);
  assert.match(print, /item\.maxUses === null \? "N\/A"/);
  assert.match(print, /voucher-section/);
  assert.match(print, /voucher-members/);
  assert.match(print, /Attendance %/);
  assert.match(print, /Total Visits/);
  assert.match(print, /Missed Days/);
  assert.match(print, /Gym Breakdown/);
  assert.match(print, /Missed dates/);
  assert.match(print, /attendanceFilter/);
});
