# BestGymsMalta Staff Attendance, Fingerprint Punch Clock & Payroll — Design

Date: 2026-10-06
Status: Approved design, pending implementation plan
Depends on: current Production Staff Portal / Super Admin architecture, existing gym records, system authentication and audit patterns

## 1. Purpose

Add a dedicated staff-employment, attendance and payroll-timesheet subsystem to BestGymsMalta.

The subsystem must let Super Admin:

- create and manage employee records;
- record whether each employee is Full Time or Part Time;
- maintain effective-dated hourly wage history;
- enrol a staff photo and, once hardware is available, a fingerprint identity;
- register dedicated punch-clock terminals per gym;
- record clock-in and clock-out events from fingerprint terminals;
- manually punch staff in or out when hardware or connectivity fails;
- correct missed or incorrect attendance with a mandatory audit reason;
- calculate exact worked minutes per session/day/week/month/selected period;
- apply public-holiday multipliers automatically;
- preserve historical wage, employment-type and public-holiday calculations;
- generate, print, export and email staff-specific timesheets;
- optionally include or hide salary information on employee-facing reports.

The system is online-only in Version 1. Offline punch buffering/synchronisation is out of scope.

## 2. Architectural Choice

Use a **dedicated employee/attendance subsystem inside the existing BGM Supabase project**.

Do not reuse `bgm_system_users` as the employment/payroll identity.

Existing Staff Logins remain portal-access accounts only. An employee may later be linked to a system user if useful, but employment identity, attendance, biometrics and payroll remain independent.

This separation prevents login-account changes, gym permissions or portal access from rewriting payroll identity/history.

## 3. Access Control

Central employee, attendance, payroll, rate, holiday, terminal and audit data is visible only to Super Admin.

Gym punch-clock terminals are not general Staff Portal sessions. Each terminal uses a dedicated device identity/credential and exposes only the minimum punch interface.

A terminal must not expose:

- staff directory browsing;
- hourly rates;
- payroll totals;
- attendance history for other staff;
- Super Admin controls.

The server determines the terminal's gym from the registered terminal identity, not from a freely editable client-submitted gym ID.

## 4. Employee Records

Create a dedicated employee record with at least:

- internal employee UUID;
- first name;
- surname;
- ID card / identity document number;
- address;
- mobile;
- email;
- assigned/home gym;
- staff photo reference;
- active/inactive employment status;
- fingerprint enrolment status;
- created/updated metadata;
- optional link to a system-user account without making that link mandatory.

Assigned/home gym is administrative information only. It does not restrict where the employee may work.

If an employee assigned to Tal-Qroqq punches at Birkirkara, the attendance event records Birkirkara as the actual worked gym.

Employees are deactivated rather than hard-deleted so historical attendance and payroll remain intact.

## 5. Employment Type History

Each employee has an effective-dated employment type:

- Full Time
- Part Time

Employment-type changes must support an **Effective From** date.

Historical payroll must use the employment type that applied on the work date, not the employee's current type.

Example:

- Part Time effective 01/01/2026
- Full Time effective 01/11/2026

October payroll remains Part Time even after the November change is entered.

## 6. Hourly Rate History

Hourly wages are effective-dated and versioned.

Each rate record contains at minimum:

- employee ID;
- hourly rate;
- effective-from date;
- optional effective-to date derived or managed consistently;
- created-by Super Admin;
- created timestamp.

A new rate must never rewrite historical payroll.

Example:

- EUR 8.50/hour effective 01/01/2026
- EUR 9.25/hour effective 01/11/2026

October work remains calculated at EUR 8.50/hour.

No overtime premium exists. Overtime is paid at the same normal hourly rate.

## 7. Public Holidays

Super Admin gets a dedicated Public Holidays management area.

Each holiday contains:

- holiday name;
- calendar date;
- Full Time multiplier;
- Part Time multiplier;
- active/inactive status;
- optional note;
- audit/version metadata.

Example:

`Christmas Day | 25/12/2026 | Full Time 2.0x | Part Time 1.5x`

The payroll engine selects the multiplier by:

1. work date;
2. employee employment type effective on that date.

The applicable multiplier is applied to that employee's applicable base hourly rate.

Historical public-holiday calculations must be preserved. Later edits to a holiday or its multipliers must not retroactively change completed historical payroll results.

## 8. Punch-Clock Terminals

Each gym may have one or more registered punch-clock terminals.

A terminal record contains at minimum:

- terminal UUID;
- friendly name, e.g. `Birkirkara Punch Clock 1`;
- gym ID;
- secure device credential / credential hash;
- active/inactive status;
- hardware/vendor metadata when known;
- last-seen timestamp.

Super Admin can:

- create/register a terminal;
- rename it;
- assign/reassign it to a gym;
- activate/deactivate it;
- review status/last seen.

Version 1 is online-only. If the device, fingerprint scanner or internet is unavailable, Super Admin uses the manual-punch fallback.

## 9. Fingerprint Architecture

Do not store raw fingerprint images.

Hardware integration is deliberately abstracted because the scanner model/SDK is still pending.

Preferred implementation order:

1. build employee, attendance, payroll and terminal systems independent of hardware;
2. define a biometric adapter contract;
3. when hardware arrives, integrate either:
   - an encrypted fingerprint template; or
   - a vendor/device template reference where the hardware performs matching.

Fingerprint identity must be unique per employee under the chosen hardware model.

If the hardware supports only local/device-side templates, the integration must preserve the same server-authoritative punch state and payroll rules.

## 10. Attendance State Model

Attendance is modelled as repeated IN-to-OUT work sessions.

Global state per employee:

- no open work session -> next valid punch becomes **Clock In**;
- open work session -> next valid punch becomes **Clock Out**.

The open-session state is global across all gyms.

Therefore an employee may:

- clock in at Birkirkara;
- finish at Tal-Qroqq;
- clock out at Tal-Qroqq;
- retain one continuous work session with separate clock-in and clock-out gym references.

Only one open session may exist per employee at a time.

## 11. Multiple Sessions in One Day

There is no separate break mode.

Every IN-to-OUT pair is a distinct work session.

If someone punches:

- IN 08:00
- OUT 12:00
- IN 13:00
- OUT 17:00

both sessions are shown individually and the Daily Total is 8 hours.

Weekly, monthly and selected-period totals sum the applicable session minutes.

## 12. Exact-Minute Calculation

Worked time is calculated to the exact minute.

There is no 5-, 10- or 15-minute rounding rule.

Server timestamps may retain second-level precision for audit purposes, but payroll/reporting calculations and user-facing duration totals use actual elapsed time expressed in minutes under one consistent deterministic rule.

## 13. Cross-Midnight Sessions

A work session may remain one underlying session if it crosses midnight, but daily totals are split by calendar date in `Europe/Malta`.

Example:

- Clock In 22:00 on Day 1
- Clock Out 06:00 on Day 2

Daily allocation:

- Day 1: 22:00-00:00
- Day 2: 00:00-06:00

Public-holiday and employment/rate rules are applied to the relevant calendar-day portions.

Although BGM does not normally operate such shifts, the data model must behave correctly if one occurs.

## 14. Immutable Punch Events and Work Sessions

For strong auditability, keep raw punch evidence separate from corrected payroll sessions.

Use an immutable punch-event concept containing at minimum:

- employee ID;
- timestamp;
- terminal ID or manual source;
- actual gym;
- resolved action (IN/OUT);
- event/source identity;
- creation metadata.

Use work sessions to pair punches and drive timesheets/payroll.

Manual corrections do not erase or rewrite the original fingerprint punch event.

## 15. Duplicate-Scan Protection

A rapid accidental second fingerprint scan must not immediately reverse the first action.

Implement a short server-enforced duplicate/cooldown rule and/or idempotent terminal event ID.

The exact cooldown duration can be implementation-configured, but the server remains authoritative.

## 16. Manual Punch Fallback

Super Admin can manually punch an employee in or out when:

- hardware fails;
- internet/terminal issues occurred;
- the employee forgot to punch;
- operational correction is required.

Manual punch form requires:

- employee;
- Clock In or Clock Out;
- gym;
- date/time;
- mandatory reason.

Manual punches participate in attendance/payroll totals exactly like normal punches but remain permanently identified as Super Admin/manual actions.

## 17. Attendance Corrections

Super Admin may correct:

- clock-in time;
- clock-out time;
- clock-in gym;
- clock-out gym;
- missing punch;
- incorrectly paired operational data where safely supported.

Every correction must record:

- acting Super Admin;
- timestamp;
- mandatory reason;
- before values;
- after values.

Original source evidence remains preserved.

Open/missing sessions are marked **Needs attention** rather than auto-filled with guessed times.

## 18. Payroll Calculation

Ordinary payroll uses:

`(worked minutes / 60) x applicable hourly rate`

No overtime premium applies.

For public-holiday minutes:

`(worked minutes / 60) x applicable base hourly rate x applicable employment-type holiday multiplier`

The engine must resolve rates and employment type by effective date.

Where a session crosses a rate/employment/public-holiday boundary, calculations are partitioned by applicable calendar segment rather than assuming one value for the entire session.

Historical payroll results must remain reproducible using effective-dated history and/or persisted calculation snapshots.

## 19. Historical Preservation

The following must never be retroactively changed by later configuration edits:

- previously applicable hourly wage;
- previously applicable employment type;
- previously applicable public-holiday multiplier;
- original punch events;
- prior manual corrections/audit trail.

Implementation should use effective-dated history plus calculation snapshots where useful so historical reports remain stable and auditable.

## 20. Super Admin Navigation

Add a new top-level Super Admin **Staff** area that is separate from existing **Staff Logins**.

Recommended structure:

- Employees
- Timesheets
- Public Holidays
- Punch Clock Terminals

### 20.1 Employees

Directory supports search/filter and shows at minimum:

- photo;
- name;
- home gym;
- email/mobile;
- current hourly rate;
- Full Time / Part Time;
- fingerprint status;
- active/inactive status.

Employee detail tabs:

- Details
- Attendance
- Payroll
- Audit

### 20.2 Timesheets

Filters include:

- employee;
- assigned/home gym;
- actual worked gym;
- date range;
- this week;
- this month;
- custom period;
- complete/open/needs-attention status.

Each session row shows:

- date;
- time in;
- clock-in gym;
- time out;
- clock-out gym;
- worked duration.

Daily, weekly, monthly and selected-period totals are shown.

Problem/open sessions are visually highlighted.

## 21. Reporting and Exports

Super Admin can:

- print/save PDF;
- export Excel;
- email one employee;
- email selected employees;
- email all employees in the current filtered period.

Management exports may contain multiple employees.

Employee-facing email reports must remain strictly one employee per generated report/attachment.

## 22. Email Privacy Rule

This is a hard privacy requirement.

When emailing staff timesheets:

- Staff A receives only Staff A data;
- Staff B receives only Staff B data;
- no combined multi-employee attachment is sent to employees;
- recipient email must be validated against the employee whose report is generated;
- employees without an email address are skipped and reported clearly to Super Admin.

Batch sending must create separate report jobs/attachments per employee.

## 23. Salary Visibility on Employee Reports

Before sending/printing an employee-facing timesheet, Super Admin chooses whether salary data is included.

If salary is hidden, report includes:

- dates;
- gyms;
- clock-in/out times;
- session durations;
- daily/weekly/monthly/period hours.

If salary is shown, also include:

- applicable hourly rate;
- holiday multiplier where relevant;
- pay calculation;
- selected-period pay total.

Salary visibility changes only the report output; it does not alter Super Admin data access.

## 24. Punch-Clock Kiosk UX

The kiosk UI is deliberately minimal.

Show:

- BGM branding;
- terminal/gym identity;
- current date/time;
- fingerprint waiting/scan state.

After a successful punch, briefly show:

- employee photo;
- employee name;
- CLOCKED IN or CLOCKED OUT;
- gym;
- time;
- optionally today's running worked total after clock-out.

Then automatically return to the waiting state.

The kiosk must not let staff manually choose another gym.

## 25. Security and Data Integrity

Required protections include:

- Super Admin-only payroll/employee APIs;
- terminal-specific authenticated punch endpoint;
- terminal gym resolved server-side;
- one open session maximum per employee;
- inactive employee cannot punch;
- inactive terminal cannot punch;
- duplicate-scan/idempotency protection;
- immutable source punch events;
- mandatory reason for manual edits;
- audit entries for rate, employment-type, holiday, terminal and attendance changes;
- `Europe/Malta` used for local calendar/reporting boundaries.

## 26. Rollout Strategy

### Phase 1 — Core system without fingerprint hardware

Build and test:

- employee management;
- Full Time / Part Time effective-dated history;
- hourly-rate history;
- public holidays with separate FT/PT multipliers;
- terminal registration;
- attendance state engine;
- manual punches;
- corrections/audit;
- timesheets;
- payroll calculations;
- PDF/Excel/email reporting;
- kiosk simulation / mocked biometric events.

This phase can be fully tested without the physical reader.

### Phase 2 — Fingerprint hardware integration

After the scanner model and SDK are known:

- implement the biometric adapter;
- enrol fingerprint templates/references;
- connect the physical reader to kiosk flow;
- verify duplicate scans, cross-gym state and error handling;
- verify template privacy/storage behaviour;
- run end-to-end terminal testing.

The hardware integration must not require redesigning the attendance/payroll data model.

## 27. Testing Requirements

At minimum test:

- no open session -> fingerprint/manual event clocks IN;
- open session -> next valid event clocks OUT;
- cross-gym clock-out closes the same open session;
- multiple same-day sessions remain separate and sum correctly;
- exact-minute totals;
- cross-midnight allocation;
- Malta date boundaries and DST-sensitive cases;
- normal rate with no overtime premium;
- Full Time vs Part Time holiday multiplier selection;
- effective-dated hourly-rate changes;
- effective-dated employment-type changes;
- historical results remain unchanged after later edits;
- one-open-session database enforcement;
- duplicate fingerprint event protection;
- inactive employee rejection;
- disabled terminal rejection;
- manual correction audit preservation;
- employee email privacy isolation;
- salary-visible and salary-hidden report variants;
- employees with missing email are safely skipped/reported;
- Super Admin authorization on all sensitive routes.

## 28. Production Safety

Implementation must follow the existing BGM production-safety approach:

- develop on a feature branch;
- use TEST Supabase first for schema/data testing;
- do not write Production data without explicit approval;
- use CI and Preview verification before merge;
- keep migrations forward-only and auditable;
- avoid unnecessary Vercel deployments;
- deploy to Production only after functional verification and explicit approval.

## 29. Out of Scope for Version 1

Not included unless separately approved:

- offline attendance buffering/sync;
- overtime premiums;
- different weekend/night-shift premiums;
- annual leave / sick leave / rota scheduling;
- direct payroll-bank/payment execution;
- employee self-service payroll portal;
- raw fingerprint-image storage;
- automatic guessed clock-out times.

## 30. Acceptance Summary

The design is accepted when the implementation can safely support this end-to-end scenario:

1. Super Admin creates an employee, assigns home gym, employment type and effective-dated hourly rate.
2. Super Admin registers a gym punch-clock terminal.
3. Employee punches in at one gym and may punch out at another.
4. Multiple same-day sessions remain visible and sum to a daily total.
5. Public-holiday minutes automatically use the correct Full Time or Part Time multiplier.
6. Historical wage/type/holiday calculations remain stable after later changes.
7. Super Admin can manually punch/correct attendance with a permanent audit trail.
8. Timesheets show daily/weekly/monthly/selected-period totals and calculated pay.
9. Super Admin can export/print reports and email individual staff reports with salary shown or hidden.
10. No employee ever receives another employee's timesheet data.
11. Fingerprint hardware can later be attached through an adapter without redesigning the core subsystem.
