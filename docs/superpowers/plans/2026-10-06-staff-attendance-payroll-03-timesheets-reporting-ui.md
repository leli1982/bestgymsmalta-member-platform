# Staff Attendance & Payroll Plan 03 — Timesheets, Reporting, Email & Super Admin UX

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Implement task-by-task with RED/GREEN verification and commits.

**Goal:** Deliver the complete Super Admin timesheet/payroll workflow: filtered attendance, individual sessions and daily/weekly/monthly/period totals, Needs Attention corrections, salary calculations, A4 print/PDF, management Excel and privacy-safe employee email delivery.

**Architecture:** Reporting reads persisted work sessions and immutable payroll segments rather than recalculating historical pay from current settings. One server report builder becomes the canonical source for UI, print, Excel and email. Employee-facing exports are generated one employee at a time and salary inclusion is explicit.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, ExcelJS, Nodemailer/Gmail SMTP, existing European/Malta date helpers, browser A4 print pattern, Node/Playwright tests.

**Spec:** `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`

## Global Constraints

- Timesheets/payroll are Super Admin only.
- Historical pay comes from persisted payroll segments; current rate/config changes must not alter old results.
- Employee emails never contain another employee's data.
- Missing email is skipped and reported; do not fail the entire batch.
- Salary can be included or hidden on employee reports.
- Management export may contain multiple employees; employee reports may not.
- Exact individual sessions remain visible; day/week/month/period totals are aggregates over them.
- Open/Needs Attention sessions are visible but do not fabricate pay/time beyond confirmed/corrected values.
- All date filtering/day grouping is `Europe/Malta`.
- Display dates use European `DD/MM/YYYY` style.

## Task 1: Add canonical timesheet report builder

**Files:**
- Create: `lib/staffTimesheetReport.ts`
- Create: `tests/staff-timesheet-report.test.mjs`

**Interfaces:**

```ts
export type StaffTimesheetFilters = {
  employeeId?: string;
  homeGymId?: string;
  workedGymId?: string;
  fromDate: string;
  toDate: string;
  status?: "all" | "complete" | "open" | "needs_attention";
};

export type StaffTimesheetEmployeeReport = {
  employee: { id: string; name: string; email: string | null; homeGymName: string | null };
  sessions: StaffTimesheetSession[];
  days: StaffTimesheetDay[];
  weeklyTotals: StaffPeriodTotal[];
  monthlyTotals: StaffPeriodTotal[];
  selectedPeriod: { workedMinutes: number; payCents: number; normalPayCents: number; holidayPayCents: number };
};
```

- [ ] **Step 1: Write RED pure/report-shaping tests**

Use fixture rows to cover:
- two IN/OUT pairs on same day listed separately and daily sum;
- cross-gym IN/OUT labels;
- cross-midnight underlying session appearing across two daily allocations;
- week/month totals;
- normal and holiday pay separately summed;
- open session flagged without invented OUT/pay;
- historical snapshots remain unchanged when fixture 'current rate' differs.

- [ ] **Step 2: Prove RED**

```bash
node --experimental-strip-types --test tests/staff-timesheet-report.test.mjs
```

- [ ] **Step 3: Implement pure grouping/aggregation**

Group work by persisted payroll segment date, but retain original session references so session rows can show actual IN/OUT values. Use stored `pay_cents` and `worked_minutes`; do not re-run wage/holiday lookup for historical closed segments.

Weekly grouping uses a documented Monday-Sunday Malta calendar week. Monthly grouping uses calendar month.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-timesheet-report.test.mjs
git add lib/staffTimesheetReport.ts tests/staff-timesheet-report.test.mjs
git commit -m "feat: add staff timesheet report model"
```

---

## Task 2: Add Super Admin timesheet query API

**Files:**
- Create: `app/api/system/staff-attendance/timesheets/route.ts`
- Create: `tests/staff-timesheet-api-contract.test.mjs`

**Interfaces:**
- `GET /api/system/staff-attendance/timesheets?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=&homeGymId=&workedGymId=&status=`

- [ ] **Step 1: Write RED API contract tests**

Assert:
- `requireSuperAdmin`;
- date range validation;
- maximum safe date span for interactive response or pagination;
- filter by home gym independently from actual worked gym;
- works with both `clock_in_gym_id` and `clock_out_gym_id` for actual-gym filtering;
- uses payroll segment snapshots;
- no endpoint for normal staff.

- [ ] **Step 2: Implement server query**

Fetch only employees matching employee/home-gym filter, sessions intersecting requested Malta date range, payroll segments within date range and adjustment/problem metadata.

`workedGymId` matches a session if that gym appears in either IN or OUT location, and report session shows both locations distinctly.

Return grouped employee reports + global summary.

- [ ] **Step 3: Run and commit**

```bash
node --experimental-strip-types --test tests/staff-timesheet-api-contract.test.mjs tests/staff-timesheet-report.test.mjs
git add app/api/system/staff-attendance/timesheets/route.ts tests/staff-timesheet-api-contract.test.mjs
git commit -m "feat: add staff timesheet query api"
```

---

## Task 3: Build Super Admin Timesheets UI

**Files:**
- Create: `components/staff/StaffTimesheetsAdmin.tsx`
- Modify: `app/staff/admin/staff/page.tsx`
- Modify: `components/staff/StaffEmployeeDetail.tsx`
- Create: `tests/staff-timesheets-ui-contract.test.mjs`

**Interfaces:**
- Staff section -> `Timesheets`.
- Employee detail `Attendance` and `Payroll` tabs consume same report API.

- [ ] **Step 1: Write RED UI contract**

Require filters for employee, home gym, actual worked gym, this week, this month, custom range and complete/open/needs-attention. Require rows containing date, IN time/gym, OUT time/gym and worked duration. Require Daily/Weekly/Monthly/Selected Period totals.

- [ ] **Step 2: Implement filters and list**

Default to current month. Searchable employee selector. Highlight `OPEN` / `NEEDS ATTENTION` distinctly. Do not show fabricated duration/pay for unresolved session.

Render multiple sessions per day individually followed by day total.

- [ ] **Step 3: Add payroll summary**

Show selected-period:
- worked hours/minutes;
- normal pay;
- public-holiday pay;
- total calculated pay.

Holiday segments display holiday name and multiplier used, including Full Time/Part Time context where helpful.

- [ ] **Step 4: Integrate manual punch/correction UX**

Buttons:
- `Manual Punch`;
- `Correct Session` for authorized session.

Modals require mandatory reason and use APIs from Plan 02. After success refetch report. Preserve visible indication that correction/manual input exists.

- [ ] **Step 5: Run and commit**

```bash
node --experimental-strip-types --test tests/staff-timesheets-ui-contract.test.mjs tests/staff-timesheet-api-contract.test.mjs
npx tsc --noEmit

git add components/staff/StaffTimesheetsAdmin.tsx app/staff/admin/staff/page.tsx components/staff/StaffEmployeeDetail.tsx tests/staff-timesheets-ui-contract.test.mjs
git commit -m "feat: add super admin staff timesheets"
```

---

## Task 4: Add print / Save PDF surface

**Files:**
- Create: `app/staff/admin/staff/timesheets/print/page.tsx`
- Create: `components/staff/StaffTimesheetPrint.tsx`
- Create: `tests/staff-timesheet-print-contract.test.mjs`

**Interfaces:**
- Print page accepts a server-verifiable report token/query or employee/date/filter params, always re-authorized as Super Admin.
- Supports salary shown/hidden.

- [ ] **Step 1: Write RED print contract**

Require A4 print CSS, European dates, BGM heading, employee identity, selected period, session/daily totals and salary conditional rendering.

- [ ] **Step 2: Implement print component using voucher-report pattern**

Use browser print for `Print / Save PDF`; do not add a PDF dependency solely for print.

For one employee, print a clean individual timesheet. For management multi-employee print, page-break between employees and clearly label each section.

- [ ] **Step 3: Ensure salary-hidden print contains no rate/pay values**

Conditional rendering must omit, not merely CSS-hide, salary/rate values.

- [ ] **Step 4: Run and commit**

```bash
node --experimental-strip-types --test tests/staff-timesheet-print-contract.test.mjs
git add app/staff/admin/staff/timesheets/print/page.tsx components/staff/StaffTimesheetPrint.tsx tests/staff-timesheet-print-contract.test.mjs
git commit -m "feat: add staff timesheet print reports"
```

---

## Task 5: Add management Excel export

**Files:**
- Create: `lib/staffTimesheetWorkbook.ts`
- Create: `app/api/system/staff-attendance/export/route.ts`
- Create: `tests/staff-timesheet-export.test.mjs`

**Interfaces:**
- `GET /api/system/staff-attendance/export?...&salary=include|hide`

- [ ] **Step 1: Write RED workbook/export tests**

Test workbook model includes selected filters, employee, date, IN/OUT gyms/times, minutes/hours, holiday details and pay when included. Salary-hidden workbook must contain none of `Hourly Rate`, `Pay`, rate cents or payroll values.

- [ ] **Step 2: Implement ExcelJS workbook builder**

Use existing audit-export approach. Recommended workbook:
- `Timesheets` sheet — session/day details;
- `Summary` — employee selected-period totals;
- optional `Needs Attention` sheet.

Management export may include multiple employees.

- [ ] **Step 3: Add Super Admin export route**

Rebuild report server-side from filters. Do not accept client-provided report rows.

- [ ] **Step 4: Run and commit**

```bash
node --experimental-strip-types --test tests/staff-timesheet-export.test.mjs
git add lib/staffTimesheetWorkbook.ts app/api/system/staff-attendance/export/route.ts tests/staff-timesheet-export.test.mjs
git commit -m "feat: add staff timesheet Excel export"
```

---

## Task 6: Add individual and batch employee email delivery

**Files:**
- Create: `lib/staffTimesheetMailer.ts`
- Create: `app/api/system/staff-attendance/email/route.ts`
- Create: `tests/staff-timesheet-email-privacy.test.mjs`

**Interfaces:**
- `POST /api/system/staff-attendance/email`

Request:

```ts
{
  employeeIds: string[];
  fromDate: string;
  toDate: string;
  includeSalary: boolean;
}
```

Response returns per employee `sent | skipped_missing_email | failed`.

- [ ] **Step 1: Write RED privacy tests first**

This is a launch-blocking security test. Use two employees with distinct names/emails/session/pay data and assert:
- email A recipient is A saved email only;
- email A body/attachment contains A data and no B name/email/attendance/pay;
- email B contains no A data;
- no multi-employee attachment is generated;
- salary-hidden report contains no rate/pay headings or values;
- missing-email employee is skipped without emailing another address.

- [ ] **Step 2: Implement one-report-per-employee builder**

For each employee ID:
1. fetch canonical report from server data;
2. fetch saved employee email from employee record;
3. generate one individualized XLSX attachment (or report attachment) and concise email body;
4. call mailer once for that recipient;
5. never reuse combined workbook/message body.

Use existing `lib/operationsMailConfig.ts` / Gmail SMTP env configuration, but create a dedicated subject/body builder rather than sending through an operations distribution list.

Suggested subject:

`BestGymsMalta Timesheet — <Employee Name> — <DD/MM/YYYY> to <DD/MM/YYYY>`

- [ ] **Step 3: Implement API orchestration**

Require Super Admin. Clamp batch size to a safe number. Continue after individual failure and report outcome per employee. Audit only metadata (`employee_id`, range, includeSalary, outcome), never attachment content.

- [ ] **Step 4: Prove privacy tests GREEN**

```bash
node --experimental-strip-types --test tests/staff-timesheet-email-privacy.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/staffTimesheetMailer.ts app/api/system/staff-attendance/email/route.ts tests/staff-timesheet-email-privacy.test.mjs
git commit -m "feat: add private staff timesheet emails"
```

---

## Task 7: Add report actions to UI and audit visibility

**Files:**
- Modify: `components/staff/StaffTimesheetsAdmin.tsx`
- Modify: `components/staff/StaffEmployeeDetail.tsx`
- Modify: `lib/auditTrail.ts` or audit categorization migration only if required to label staff payroll operations cleanly
- Create/Modify: `tests/staff-timesheet-actions-ui-contract.test.mjs`

- [ ] **Step 1: Write RED UI action contract**

Require:
- Print / Save PDF;
- Export Excel;
- Email selected;
- Email all filtered;
- salary include/hide toggle before employee email/print;
- missing-email preview/warning before send;
- send results showing sent/skipped/failed.

- [ ] **Step 2: Implement actions**

Disable action while request active; confirmation for batch email must state how many individual emails will be sent and how many lack email addresses.

- [ ] **Step 3: Expose employee-specific audit**

Employee detail Audit tab shows relevant central audit + attendance adjustment records ordered newest first. Super Admin can see who made manual punch/correction and reason.

- [ ] **Step 4: Run tests/type/build and commit**

```bash
node --experimental-strip-types --test tests/staff-timesheet-actions-ui-contract.test.mjs tests/staff-timesheet-email-privacy.test.mjs tests/staff-timesheet-export.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build

git add components/staff/StaffTimesheetsAdmin.tsx components/staff/StaffEmployeeDetail.tsx lib/auditTrail.ts tests/staff-timesheet-actions-ui-contract.test.mjs
git commit -m "feat: complete staff timesheet reporting workflow"
```

## Plan 03 completion checkpoint

In TEST, create at least:
- one Full Time employee;
- one Part Time employee;
- ordinary-day sessions;
- public-holiday sessions with differing FT/PT multipliers;
- multiple same-day sessions;
- cross-gym session;
- open Needs Attention session;
- one manually corrected session.

Verify UI totals exactly match database payroll segments. Change current rates/holiday multipliers afterward and prove historical report values remain unchanged.

Perform a safe email test using controlled test addresses only; prove individualized isolation before any real employee email is attempted.

No Production mutation/deployment in this plan.