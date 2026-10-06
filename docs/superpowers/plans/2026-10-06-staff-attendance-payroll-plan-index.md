# Staff Attendance, Fingerprint Punch Clock & Payroll — Plan Index

Date: 2026-10-06
Status: Ready for user review before implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved BestGymsMalta staff-employment, attendance, terminal, payroll-timesheet and later fingerprint-integration subsystem without altering current member/reception behaviour.

**Architecture:** Keep employment/payroll identity separate from `bgm_system_users`. Store immutable punch evidence, paired work sessions, effective-dated employment/rate configuration and persisted payroll segments. Super Admin owns all management/reporting actions. Registered terminal credentials determine gym identity. Fingerprint hardware is isolated behind an adapter and is not required to complete the core system.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS, Supabase PostgreSQL/Storage, existing signed system-session auth, Node 22 test runner, Playwright, ExcelJS, Nodemailer/Gmail SMTP, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`

## Global Constraints

- Implementation branch: `feature/staff-attendance-payroll`.
- Before creating/pushing it, add it to `vercel.json` with `deploymentEnabled: false` and to Phase 2 CI push branches.
- TEST Supabase first: `vlvyqdjhzdcxatilbdiv`. Production `jsuolemirhivqhjbjetv` is untouched until explicit approval.
- Employee/payroll identity is separate from Staff Portal login identity.
- All employee, pay, timesheet, holiday, terminal and audit management is Super Admin only.
- Home gym does not restrict worked gym; cross-gym clock-out is valid.
- No break mode; each IN→OUT pair is a session; multiple sessions/day are retained and summed.
- One global open session max per employee. Missing OUT remains Needs Attention; never invent time.
- Version 1 is online-only with Super Admin manual fallback.
- Raw/source punch evidence is immutable. Corrections are audited and preserve original evidence.
- Worked time is minute-precision with no 5/10/15-minute rounding; all calendar allocation uses `Europe/Malta`, including DST.
- Cross-midnight sessions split into daily payroll portions while remaining one underlying session.
- Overtime uses normal hourly rate; no overtime premium.
- Hourly rate and Full Time/Part Time are effective-dated.
- Public holidays have separate Full Time and Part Time multipliers.
- Closed historical payroll never changes because of later wage, employment-type or holiday edits.
- Money is integer euro cents; multiplier basis points use `10000 = 1.0x` and `20000 = 2.0x`.
- Employee deactivation prevents future punches but retains history.
- Never store raw fingerprint images. Final SDK uses encrypted template or vendor/device reference as appropriate.
- Employee email reports are isolated one employee per message/report; salary visibility is explicit.
- UI date display remains European `DD/MM/YYYY`.

## Review Focus

1. **Concurrent/double punches:** near-simultaneous scans must not create duplicate transitions or more than one open session.
2. **Malta date/DST splitting:** cross-midnight and DST transition days must allocate correct actual minutes to the correct Malta date.
3. **Historical preservation:** later wage/type/holiday edits and attendance corrections must not silently rewrite prior payroll configuration snapshots.
4. **Email privacy:** batch sending must never leak Employee A data into Employee B's report, and salary-hidden output must omit pay/rate data.
5. **Terminal security:** actual gym comes only from the authenticated active terminal; request-body gym spoofing and disabled terminals are rejected.

## Read in this order

1. `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md` — approved design.
2. `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-01-foundation-employees.md` — branch safety, schema, employees, rates, employment type, holidays, photos.
3. `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-02-attendance-terminals.md` — registered terminals, atomic punch state, manual fallback/corrections, kiosk shell.
4. `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-03-timesheets-reporting-ui.md` — timesheets, payroll totals, print/PDF, Excel, privacy-safe email.
5. `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-04-hardware-release.md` — real scanner/SDK adapter, hardware tests and controlled release.
6. `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-self-review-amendments.md` — required historical-preservation and hardening corrections found during final self-review.

If the amendment conflicts with Plans 01–04, the amendment wins for that specific topic.

The plans are sequential. Plans 01–03 produce a complete online/manual attendance and payroll system independent of the physical reader. Plan 04 enables real fingerprint punching after the hardware/SDK is known and verified.

## Locked implementation model

- `bgm_staff_punch_events` is append-only evidence.
- `bgm_staff_work_sessions` is the effective paired attendance record.
- `bgm_staff_session_payroll_segments` stores immutable daily calculation snapshots with rate/type/holiday references and pay cents.
- Corrections create immutable adjustment + central audit records; they do not erase punch evidence.
- Registered terminal credential determines gym. Fingerprint adapter determines employee.
- Closed payroll snapshots are authoritative historical report data.

## Final verification baseline

Each plan runs targeted RED/GREEN tests and commits. Final release verification runs at minimum:

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
node tests/browser/staff-attendance-payroll.mjs
```

Also rerun existing high-value Staff/Member browser tests covering Super Admin home, scanner/reception and enrollment. No test is weakened to make implementation pass. No Production deployment occurs without a separate explicit user approval checkpoint.