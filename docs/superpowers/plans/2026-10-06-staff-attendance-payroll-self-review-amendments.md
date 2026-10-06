# Staff Attendance & Payroll — Self-Review Amendments

Date: 2026-10-06
Status: Required corrections from final spec-to-plan review
Applies after: Plans 01–04

If this document conflicts with wording in Plans 01–04, **this amendment wins for the specific topics below**.

## 1. Attendance corrections must not silently adopt later payroll configuration

Plan 02's correction task says a corrected closed session rebuilds derived payroll segments from current effective-date history. That is too broad and can violate the approved requirement that historical payroll remain preserved.

### Required rule

When correcting a **previously calculated closed session**, the correction engine must preserve the payroll configuration snapshot that originally applied to each unchanged calendar-date portion:

- hourly rate record / rate cents;
- employment type record/type;
- public-holiday version / multiplier.

A correction to attendance time/gym must not silently make old payroll adopt a wage, employment-type change or holiday multiplier that was configured later.

### Boundary cases

- If corrected times remain on the same Malta calendar date(s), reuse the existing payroll configuration snapshot(s) and recalculate only minutes/pay from the corrected attendance duration.
- If correction introduces a **new Malta calendar date portion** that did not exist in the original payroll segments, resolve configuration for that new date from the effective-dated histories and current valid holiday version, persist a new snapshot, and audit that this was a newly introduced date portion.
- If correction removes a calendar-date portion, supersede/remove only the derived segment for that session/date as part of the correction transaction; preserve its previous values in the immutable adjustment before-snapshot.
- If Super Admin intentionally needs to correct a historical wage/employment/holiday configuration itself, that must be a separate explicit audited configuration-correction workflow; it must not happen as a side effect of editing attendance.

### Required regression test

Add to `tests/staff-attendance-correction-contract.test.mjs`:

1. Close a session using €8.50/hour and holiday multiplier/version A.
2. Later create a backdated/newer wage or holiday configuration that would otherwise change the same date.
3. Correct only the session clock-out time.
4. Assert the rebuilt segment still references the original rate/history and holiday-version snapshot while recalculating only worked minutes/pay.

## 2. Public-holiday edits preserve closed payroll snapshots

Holiday identity/versioning is configuration history; persisted payroll segments are the payroll truth for already-closed sessions.

Changing a holiday's Full Time or Part Time multiplier later must:

- create a new holiday version;
- affect future/unprocessed calculations using that version where appropriate;
- never rewrite existing `bgm_staff_session_payroll_segments` or prior exported/emailed report values.

Add a regression assertion to the historical-preservation tests in Plan 03 that changing both FT and PT multipliers after sessions close leaves existing reports/pay cents unchanged.

## 3. Exact-minute rule must be centralized

The implementation must have one documented `normalizePunchMinute()` rule used for terminal punches and manual punches before effective attendance calculation. Raw source timestamps remain preserved on punch evidence.

No route/component may independently round to 5, 10 or 15 minutes, and no client-supplied rounded duration is trusted. Add a source-contract/test asserting all punch sources use the shared normalizer.

## 4. Biometric hardware remains a release gate, not a blocker for core/manual Phase 1

Plans 01–03 may reach a release candidate with:

- employee/pay configuration;
- public holidays;
- registered terminals;
- manual Super Admin punches/corrections;
- timesheets/payroll/reporting/email;
- kiosk clearly showing `Hardware not configured`.

Do not introduce a fake employee selector into the kiosk merely to demonstrate punching. Real fingerprint punching is enabled only after Plan 04 real-hardware verification.

## 5. Final self-review result

After these amendments, every approved design requirement maps to a plan task. The highest-risk requirements are pinned to explicit tests:

- concurrent/double punches → Plan 02 state-engine concurrency tests;
- Malta cross-midnight/DST → Plan 02 date-splitting tests;
- historical payroll preservation → Plans 02/03 plus Amendment 1/2 regression tests;
- employee email isolation → Plan 03 privacy tests;
- terminal gym spoofing → Plan 02 terminal/punch endpoint tests;
- raw biometric privacy → Plan 04 adapter/enrolment tests.
