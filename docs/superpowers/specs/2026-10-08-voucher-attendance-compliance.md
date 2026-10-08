# Voucher Attendance Compliance & Reporting Specification

**Approved:** 08/10/2026

## Purpose

Extend the existing Super Admin Voucher Analytics area into an auditable attendance/compliance report for businesses that sponsor employee memberships through vouchers. Some sponsoring businesses use this data for missed-day charges or membership cancellation, so the report must be derived from authoritative BGM records and be reproducible.

## Source of truth

Attendance comes only from successful canonical BestGymsMalta member check-ins already recorded by the normal gym access flow in `bgm_member_checkins`. There is no separate voucher attendance scanner and no ordinary staff manual attendance entry. Physical-card and member-app barcode/QR access must feed the same canonical check-in records.

## Reporting period and eligibility

- Super Admin selects a voucher/company and reporting date range.
- A member is eligible only on calendar days where the selected report period overlaps a voucher-backed membership period.
- Eligibility uses Malta calendar dates.
- If a membership is cancelled, the cancellation effective date itself is not eligible because access ends on that date.
- Overlapping voucher membership periods for the same member and voucher are unioned so days are never double-counted.
- Historical membership eligibility remains reportable even if the membership is expired today.

## Attendance measures

For each member/voucher in the selected period show:

- Member name and surname
- Permanent BGM membership number
- ID number
- Enrollment gym
- Voucher/company
- Membership start and expiry context
- Eligible days
- Unique attended days
- Missed eligible days
- Attendance percentage = attended days / eligible days × 100
- Total successful gym visits
- Last qualifying visit
- Gym-by-gym visit breakdown
- Attendance status: Attended, No Show, or Not Eligible

Multiple successful visits on one eligible day count as one attended day for the percentage but every legitimate check-in counts toward Total Visits. Visits outside eligible voucher days do not count in the voucher attendance report.

## Voucher-level summary

Show eligible members, members who attended, no-show members, member participation percentage, and total qualifying visits for the selected voucher/report period.

## Filtering

Super Admin can filter the visible member list by All, Attended, and No Show while retaining the existing voucher search/status/date controls where applicable.

## Printing / PDF

Every currently selected/filtered report must be printable by Super Admin and saveable as PDF through the browser print flow. Printed reports identify the voucher/company, selected report period, generation time, attendance source, eligibility basis, summary totals, and the same per-member attendance measures including a compact gym breakdown.

## Authorization and safety

- Voucher attendance analytics and printing remain Super Admin-only.
- This phase is read-only reporting over existing membership/voucher/check-in data.
- No Production database mutation or migration is required for this phase.
- Payroll/punch-clock work is unrelated and remains untouched.
