# Staff Attendance, Fingerprint Punch Clock & Payroll — Plan Index

Date: 2026-10-06
Status: Ready for user review before implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended for maximum review depth) or `superpowers:executing-plans` (recommended for faster native execution) to implement the plans task-by-task. Do not implement directly from the product spec without following these plans.

**Goal:** Implement the approved BestGymsMalta staff-employment, attendance, terminal, payroll-timesheet and later fingerprint-integration subsystem without altering current member/reception behaviour.

**Architecture:** Keep employment/payroll identity separate from `bgm_system_users`. Store immutable punch evidence, paired work sessions, effective-dated employment/rate configuration and persisted payroll segments. Super Admin owns all management/reporting actions. Registered terminal credentials determine gym identity. Fingerprint hardware is isolated behind an adapter and is not required to complete the core system.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS, Supabase PostgreSQL/Storage, existing signed system-session auth, Node 22 test runner, Playwright, ExcelJS, Nodemailer/Gmail SMTP, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`

## Read in this order

1. Approved design: `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`
2. Plan 01: `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-01-foundation-employees.md`
3. Plan 02: `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-02-attendance-terminals.md`
4. Plan 03: `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-03-timesheets-reporting-ui.md`
5. Plan 04: `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-04-hardware-release.md`

The plans are sequential. Plan 02 depends on Plan 01 schema/domain interfaces. Plan 03 depends on immutable attendance/payroll segments from Plan 02. Plan 04 performs the scanner adapter integration and release verification only after the online/manual workflow is stable.

## Global constraints

- Implementation branch name: `feature/staff-attendance-payroll`.
- Before that branch is created/pushed, add it to `vercel.json` with `deploymentEnabled: false`; branch safety must be part of the first implementation checkpoint so normal development does not consume Vercel Preview/storage quota.
- Add the branch to the Phase 2 CI push list so GitHub verification runs without requiring Vercel.
- Production is untouched until explicit user approval. Schema is first exercised on TEST Supabase `vlvyqdjhzdcxatilbdiv`; Production `jsuolemirhivqhjbjetv` is not mutated during normal implementation.
- Do not reuse `bgm_system_users` as employee/payroll records. Staff Portal logins and employees are separate concepts.
- All central employee, pay, timesheet, holiday, terminal and audit data is Super Admin only.
- Home gym does not constrain where an employee may work.
- One employee may clock in at one gym and clock out at another.
- No break mode. Every IN-to-OUT pair is a work session; multiple sessions in one day are retained and summed.
- Only one open session may exist per employee globally.
- Version 1 is online-only. Hardware/internet failures use Super Admin manual punch/correction.
- Never invent a missing clock-out time. Open/missing sessions remain `Needs attention` until corrected.
- Keep raw/source punch events immutable. Corrections change the effective work-session values and create audit records; they do not erase original evidence.
- Worked duration is minute-precision with no 5/10/15-minute rounding. Source timestamps may retain seconds for evidence; effective attendance timestamps are normalized consistently to minute precision before payroll calculation.
- Daily allocation, effective-date lookups and public holidays use `Europe/Malta` calendar semantics, including DST boundaries.
- Cross-midnight sessions are one underlying session but are split into per-calendar-date payroll segments.
- Ordinary/overtime minutes use the same base hourly rate. There is no overtime premium.
- Hourly rates and Full Time/Part Time employment type are effective-dated.
- Public holidays contain separate Full Time and Part Time multipliers.
- Historical payroll must never change because of a later wage, employment-type or holiday edit.
- Monetary values are integer euro cents. Holiday multipliers are integer basis points (`10000 = 1.0x`, `20000 = 2.0x`) to avoid floating-point payroll drift.
- Employee deactivation prevents future punches but keeps all historical data.
- No raw fingerprint image is stored. Hardware integration uses an encrypted template or vendor/device reference depending on the final SDK.
- Employee emails are strictly one employee per message/report. Batch sending must never attach or include another employee's data.
- Salary visibility is an explicit report/email option.
- Date display remains `DD/MM/YYYY` / European formatting across the UI.

## Locked implementation model

### Historical state

Use effective-dated records for:

- hourly rate;
- employment type;
- public-holiday versions/multipliers.

Closed work sessions generate persisted daily payroll segments. Each segment snapshots the effective rate, employment type, holiday version/multiplier and calculated cents. Later configuration edits do not rewrite those snapshots.

### Punch evidence versus payroll record

Use two levels:

- `bgm_staff_punch_events`: append-only evidence of actual/manual punch actions;
- `bgm_staff_work_sessions`: the effective paired IN/OUT record used operationally.

Manual corrections create dedicated adjustment records and central `bgm_audit_log` entries. Original punch events remain unchanged.

### Terminal identity

Registered terminal credentials are server-validated and map to exactly one configured gym. The punch request must not accept an arbitrary `gymId` as authoritative input. Disabled terminals are rejected.

### Fingerprint boundary

Phase 1 and the majority of Phase 2 are hardware-independent. The server punch service accepts an already-resolved employee identity from a trusted biometric adapter. Plan 04 connects the final scanner/SDK to that interface. No production browser selector is used as a substitute for fingerprint identity.

## Review focus

Reviewers must give special attention to these five failure classes:

1. **Concurrent/double punches:** two near-simultaneous scans must not create two INs, two OUTs, or more than one open session. Terminal event IDs/cooldown must be idempotent server-side.
2. **Malta date/DST splitting:** cross-midnight and DST transition days must allocate the correct minutes to the correct Malta calendar date.
3. **Historical preservation:** later edits to wage, Full Time/Part Time status or holiday multipliers must not change already-generated payroll segments/reports.
4. **Email privacy:** a batch send must generate one isolated report per employee; Employee A content must never appear in Employee B's message/attachment, and salary-hidden output must contain no rate/pay fields.
5. **Terminal security:** the actual gym comes only from the authenticated active terminal record; request-body gym spoofing, disabled terminals and inactive employees must be rejected.

## Final verification baseline

Each plan runs targeted RED/GREEN tests and commits. The final release checkpoint runs at minimum:

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
node tests/browser/staff-attendance-payroll.mjs
```

Also rerun the existing high-value Staff/Member browser tests that exercise Super Admin home, scanner/reception and enrollment so this subsystem cannot regress launch-critical behaviour.

No test is weakened to make implementation pass. No Production deployment occurs as part of these plans without a separate explicit approval checkpoint.