# BestGymsMalta Staff Fingerprint Integration — Design

Date: 2026-10-19
Status: Approved product direction with implementation gated by the plan and the cross-terminal biometric capability proof below.
Depends on: `2026-10-06-staff-attendance-payroll-design.md`, current Phase 3 attendance/payroll implementation, existing Staff Portal terminal authentication, existing Punch Clock API and attendance state engine.

## 1. Purpose

Add permanent FP100 fingerprint identification for BGM staff attendance while preserving the existing payroll rules and keeping staff biometrics completely separate from the member barcode/card system.

The user-facing requirement is global staff identity:

- a staff employee enrolls once for BGM, not separately per gym;
- that active biometric identity is usable at any authorised BGM staff Punch Clock terminal;
- each physical punch records the terminal and gym where that punch happened;
- attendance state, worked hours and payroll are calculated from the employee's global IN/OUT sequence, never from a gym-specific state machine;
- an employee may clock IN at one gym and clock OUT at another and this remains one valid work session.

Example: Staff1 clocks IN at Birkirkara at 08:03 and OUT at Marsa at 16:12. The system records Birkirkara as the IN location, Marsa as the OUT location, and one 8h09 employee work session.

## 2. Absolute Separation From Member Scanning

### Member system

Hardware: barcode / membership-card scanner.

Purpose:

- member lookup;
- member access;
- member gym check-in.

Existing `StaffGlobalScanner` remains member-only despite its component name.

Members must never:

- enroll fingerprints;
- use fingerprints for access;
- receive biometric credentials;
- have biometric records created;
- interact with the staff biometric service.

### Staff system

Hardware: FP100 USB fingerprint reader.

Purpose:

- identify a staff employee for attendance;
- create a request for the existing BGM attendance engine to record Clock In or Clock Out.

Fingerprint events must never enter the member barcode input queue, parser, member modal state or member access-check logic.

## 3. Verified Hardware Baseline

The tested hardware is:

- FP100 USB Fingerprint Reader;
- ChipSailing driver family;
- Windows device name `ChipSailing Fingerprint UsbDriver`;
- VID/PID `USB\\VID_2541&PID_0236`;
- Windows Biometric Framework compatible;
- BASIC sensor mode verified;
- private WinBio session verified;
- temporary private biometric database verified;
- enrollment and subsequent identification verified;
- temporary enrollment/database/configuration removed after testing.

Hardware feasibility on one Windows installation is complete and must not be repeated as discovery work.

The temporary hardware-test biometric GUID is throwaway test data and must never be used as a production identity, migration value or fixture.

## 4. Critical Global-Enrollment Constraint

The earlier local-only private-WinBio model is superseded.

Standard Windows Biometric Framework enrollment commits a template to the biometric database associated with the biometric unit used for enrollment. That proves local enrollment/matching, but it does not by itself satisfy BGM's required enroll-once/use-any-gym behaviour.

Therefore the permanent design must provide a reusable global biometric identity or global matching authority. It must not require staff to enroll at every gym.

### Mandatory capability gate

Before permanent biometric implementation proceeds beyond the adapter/prototype boundary, prove on TEST hardware that:

1. one employee enrollment created on authorised machine/terminal A can be matched by a fresh fingerprint capture on authorised machine/terminal B;
2. the portable representation or matching mechanism is supported by the actual FP100/ChipSailing stack used by BGM;
3. raw fingerprint images are not persisted;
4. enrollment and probe data can be handled without exposing biometric material to browser JavaScript;
5. false/no-match/error behaviour can be distinguished reliably;
6. revocation can prevent new accepted matches globally.

Preferred implementation direction is a vendor-supported portable biometric template/feature representation or vendor-supported central matching mechanism used by a native BGM biometric service.

If this capability proof fails, implementation stops and the biometric architecture returns for review. It must not silently fall back to per-terminal/per-gym enrollment because that would violate the approved product requirement.

## 5. Chosen System Boundary

Permanent logical flow:

`FP100 reader`

→ `native BGM Windows biometric service`

→ `supported capture/template/match engine`

→ `global active BGM biometric credential`

→ `short-lived authenticated match assertion`

→ `BGM web Punch Clock integration`

→ `/api/staff-punch-clock/punch`

→ `existing employee-global attendance engine`

The browser never handles raw fingerprint frames, templates or biometric databases.

The native Windows service is the only local component allowed to talk directly to the scanner/WinBio/vendor biometric stack.

## 6. Source of Truth

The BGM staff employee ID is the permanent employee identity.

A WinBio GUID, vendor template identifier, template hash, service credential or terminal ID is never the employee primary key.

Conceptually:

`staff_employee_id` ↔ `global biometric credential` ↔ `active/revoked lifecycle`

and independently:

`registered terminal` ↔ `gym/location`

A biometric credential proves which employee matched. The authenticated terminal proves where the physical punch happened.

## 7. Biometric Data and Privacy Boundary

Never persist raw fingerprint images or raw sensor frames.

Browser code, member-system code, attendance/payroll tables and ordinary application logs must never contain biometric templates or reconstructable biometric material.

If the capability gate proves that a portable biometric template/feature representation must be stored centrally to meet global enrollment, it must be treated as sensitive biometric data and must be:

- encrypted at rest;
- encrypted in transit;
- inaccessible to browser clients;
- accessible only to the narrowly scoped biometric service/matcher;
- excluded from normal logs, exports and analytics;
- revocable/deletable through the Super Admin biometric lifecycle;
- segregated from member data;
- documented for BGM's data-protection/security review before Production.

Central metadata may include:

- employee ID;
- biometric credential ID;
- credential status;
- enrollment timestamp;
- enrollment actor;
- engine/template format version;
- revocation timestamp/reason;
- non-sensitive device/service version metadata.

The design deliberately does not claim that an encrypted biometric template is non-sensitive merely because it is not a raw image.

## 8. Native Windows Biometric Service

Responsibilities:

- detect the configured FP100 reader;
- capture enrollment samples through a supported biometric API;
- create the approved global biometric credential after the capability gate passes;
- capture transient punch probes;
- perform or request biometric matching without exposing biometric material to the browser;
- issue/receive a cryptographically authenticated short-lived match assertion;
- expose minimal reader/service health;
- support authenticated enrollment and revocation commands;
- record only non-biometric operational logs.

It must not:

- handle member barcodes;
- access member records;
- calculate wages;
- decide IN versus OUT;
- choose an arbitrary gym;
- invent punches while offline;
- present a local biometric match as a successful attendance punch before BGM server acceptance.

## 9. Global Multi-Gym Behaviour

A valid active staff biometric credential is global across BGM authorised staff Punch Clock terminals.

Rules:

- employee enrollment is not scoped to a gym;
- employee enrollment is not repeated merely because the employee works at a different gym;
- employee home gym is profile/assignment metadata only;
- any authorised active terminal may submit a valid match for any active enrolled employee;
- every physical punch independently records that terminal's configured gym;
- IN gym and OUT gym may differ;
- device replacement must not change employee identity or historical attendance;
- global revocation blocks future accepted punches at every gym.

## 10. Employee-Global Attendance State

Attendance state belongs to the employee, not the gym.

When a punch is accepted, the attendance engine must determine whether the employee currently has an open work session globally.

It must never ask, in effect, “does this employee have an open session at this gym?”

Expected behaviour:

- no global open session → Clock In;
- one global open session → Clock Out that session;
- cross-gym Clock Out is valid;
- duplicate/idempotent source event → duplicate ignored;
- conflicting or corrupt state → fail/needs attention according to existing safeguards.

Payroll duration is derived from session time boundaries. Gym IDs are audit/reporting metadata and must not split, deny or alter salary calculations.

## 11. Terminal Identity and Location Authority

A browser or biometric assertion cannot choose an arbitrary gym.

The existing authenticated registered terminal remains authoritative for:

- terminal identity;
- terminal active/inactive state;
- physical gym/location attached to that terminal.

A successful biometric assertion proves the matched staff credential/employee. The server derives the punch gym from the authenticated terminal.

Physical punch fields:

- Clock In stores IN terminal + IN gym;
- Clock Out stores OUT terminal + OUT gym;
- these may differ within one session.

## 12. Reuse Existing Punch Clock API and Attendance Engine

Do not create a second attendance implementation.

The permanent fingerprint bridge must continue through `/api/staff-punch-clock/punch` and the existing `recordStaffPunch`/database state engine.

The endpoint remains responsible for:

- terminal authentication;
- match assertion verification;
- employee/credential active-state verification;
- replay/idempotency verification;
- attendance state transition;
- terminal-derived gym/location;
- response data for UI confirmation.

Payroll decisions do not move into the native scanner service or browser.

## 13. Authenticated Match Assertion

A browser CustomEvent is an internal UI signal, never the security boundary.

The permanent biometric service/matcher must produce a short-lived authenticated assertion containing at minimum:

- `employeeId`;
- global `biometricCredentialId`;
- `terminalId`;
- unique `adapterEventId` / nonce;
- `matchedAt`;
- issued-at;
- expiry;
- protocol/version identifier.

The punch API must verify:

- assertion authenticity;
- assertion has not expired;
- terminal ID matches the authenticated terminal session;
- terminal is active;
- credential exists, is active and belongs to the employee;
- employee is active;
- event ID/nonce has not already been accepted;
- timestamps are within the permitted skew/window.

Forging `bgm:staff-biometric-match` in DevTools with an employee ID must not be sufficient to create attendance.

## 14. Browser Integration and Event Ownership

Keep these components separate:

- existing `StaffGlobalScanner` — member barcode/card only;
- new `StaffGlobalBiometricBridge` — staff biometric integration on general staff pages;
- existing `StaffPunchClockKiosk` — dedicated Punch Clock owner.

On `/staff/punch-clock`, `StaffPunchClockKiosk` is the sole biometric-event owner.

On other `/staff` pages, `StaffGlobalBiometricBridge` may own staff biometric events.

The global bridge must suppress its punch submission on `/staff/punch-clock` so one fingerprint cannot cause two browser POSTs.

Server idempotency remains a second safeguard.

## 15. Attendance UI and Member Modal Coexistence

A successful staff punch may show:

- `CLOCKED IN` or `CLOCKED OUT`;
- employee photo/name;
- effective time;
- physical punch gym/terminal;
- daily accumulated time if already returned by the server.

Other explicit states include duplicate ignored, no match, inactive employee, inactive terminal, service unavailable, revoked credential, network failure and needs attention.

If a member access modal is open, a staff fingerprint result must not close, replace, mutate or feed data into that member modal. Staff attendance uses its own notification layer.

## 16. Super Admin Global Enrollment Flow

Enrollment is controlled from Super Admin employee management only.

Flow:

1. Super Admin selects an employee.
2. Super Admin chooses `Enroll fingerprint`.
3. BGM confirms the employee and an authorised enrollment-capable terminal/service.
4. Native service performs the required capture sequence.
5. The approved global biometric credential is created only after successful enrollment.
6. Credential is associated with the employee globally, not with one gym as its scope.
7. Audit entry records employee, actor, enrollment station, timestamp and credential lifecycle reference without logging biometric material.
8. UI shows global enrollment state.

Required states:

- Enrolled — active globally;
- Not enrolled;
- Revoked;
- Re-enrollment required;
- Service/device unavailable;
- Enrollment failed.

Failed or incomplete capture must not create an active credential.

## 17. Global Revocation and Employee Deactivation

Super Admin can remove/revoke an employee fingerprint enrollment globally.

Revocation must:

- mark the global credential revoked centrally;
- make every terminal/server path reject future punches for it;
- delete/retire encrypted template material where applicable;
- invalidate any relevant matcher cache;
- audit actor, employee, credential, time and action/reason;
- preserve historical attendance.

Employee deactivation must independently block new attendance server-side even if a stale local or cached biometric representation remains.

Employee reactivation must not silently reactivate a revoked credential.

## 18. Device Replacement and Recovery

A replacement reader or Windows PC must not force creation of a new employee identity.

Once the cross-terminal capability gate is proven, an authorised replacement terminal should be provisioned and then use the same global active credential set/matching authority according to the approved mechanism.

Device credentials themselves must be separately revocable and rotated/replaced without changing historical attendance.

If the capability gate proves this cannot be achieved safely with the hardware/SDK, stop for architecture review rather than reverting to hidden per-device staff enrollment.

## 19. Online-Only Behaviour

Version 1 is online-only.

If internet, BGM API, terminal authentication, biometric matcher or required native-service communication is unavailable:

- no attendance is guessed;
- no offline punch is treated as final;
- no queued punch is silently replayed later;
- UI states that attendance was not recorded;
- Super Admin manual punch fallback remains available with mandatory reason and audit.

## 20. Automatic/System Clock-Out Contract

Every automatic logout/clock-out must be visibly flagged to Super Admin.

This applies to midnight auto-close and to any future automatic clock-out reason.

An automatic clock-out must:

- use source `system`/automatic, never impersonate a physical staff punch;
- preserve the employee's original Clock In time and physical IN gym/terminal;
- set the effective automatic Clock Out time according to the applicable rule;
- not invent a physical OUT terminal;
- not invent a physical OUT gym;
- mark the session `needs_attention` or equivalent review-required state;
- create/open a Super Admin attendance alert/exception;
- store a machine-readable reason/attention code;
- show employee, original Clock In time/location, automatic Clock Out time, reason and review status;
- remain correctable by Super Admin with mandatory correction reason;
- preserve the automatic event and subsequent correction in the audit trail;
- preserve/rebuild the historical payroll snapshot according to the established Phase 3 payroll rules.

The current Malta-midnight rule remains a system Clock Out at 00:00. The event may retain the original IN gym as contextual metadata, but `clock_out_gym_id` and `clock_out_terminal_id` remain null because no physical OUT happened there.

No automatic logout may appear indistinguishable from a normal employee fingerprint Clock Out.

## 21. Manual Fallback

Super Admin manual IN/OUT/correction remains the recovery route for hardware/network/service problems.

Manual attendance requires:

- authorised Super Admin actor;
- explicit employee;
- explicit time/action;
- mandatory reason;
- audit linkage;
- normal employee-global state/payroll rules.

A manual action must not be mislabeled as a physical fingerprint terminal event.

## 22. Failure Behaviour

All failures are explicit and fail closed.

### Fingerprint not recognised
- no attendance event;
- show `Fingerprint not recognised`;
- permit a fresh attempt.

### Reader/service/matcher unavailable
- no attendance event;
- show unavailable state;
- never fall back to member barcode logic.

### Inactive/revoked credential or employee
- reject server-side;
- no new valid attendance transition.

### Inactive/unregistered terminal
- reject server-side;
- no attendance event.

### Network/API failure
- do not claim `CLOCKED IN`/`CLOCKED OUT`;
- Super Admin manual fallback remains available.

### Duplicate/replayed event
- reject/ignore idempotently;
- do not reverse attendance state.

## 23. Audit Requirements

Audit must cover at least:

- biometric enrollment created;
- enrollment revoked/removed;
- re-enrollment;
- credential/service/device lifecycle changes;
- physical biometric punch accepted/rejected where operationally appropriate;
- manual punch/correction;
- every automatic clock-out creation;
- automatic clock-out review/correction/resolution;
- terminal replacement/revocation;
- relevant actor and timestamps.

Never audit raw fingerprint content or template blobs.

## 24. Existing Payroll Rules Remain Authoritative

This fingerprint work does not redesign Phase 3 payroll.

Existing agreed rules remain:

- exact-minute attendance;
- flat hourly rate unless a configured public-holiday multiplier applies;
- no overtime premium;
- separate Full Time / Part Time holiday multipliers;
- historical rate/employment-type/holiday multiplier snapshots preserved;
- Super Admin correction audit;
- staff receives only their own timesheet email;
- Super Admin reporting/export permissions.

The additional explicit rule is that payroll session boundaries are employee-global and are never split by gym.

## 25. Database Direction

Implementation may require new TEST-only migrations for concepts such as:

- global biometric credentials;
- credential lifecycle/audit metadata;
- authorised biometric service/device registrations;
- assertion/replay bookkeeping if not already covered by punch-event idempotency;
- generic automatic-clock-out alert/review metadata where current schema is midnight-specific.

Biometric templates, if capability testing proves central encrypted storage is required, must be stored behind a dedicated service-only boundary rather than ordinary browser-readable staff tables.

Production remains untouched until TEST verification and an explicit rollout checkpoint.

## 26. Reporting Location Semantics

Reports may show/analyse:

- Clock In gym;
- Clock Out gym;
- Clock In terminal;
- Clock Out terminal;
- cross-gym sessions;
- automatic/system Clock Outs;
- unresolved automatic-clock-out alerts.

But worked minutes and salary totals remain employee/time based.

A cross-gym session is not an error merely because IN and OUT locations differ.

## 27. Required Test Strategy

At minimum cover:

### Capability gate
- enroll on terminal A, match on terminal B;
- same employee positive match;
- wrong finger/no-match;
- revoked credential fails globally;
- no raw image/template leaks to browser/logs.

### Security
- forged browser CustomEvent cannot create a punch;
- assertion terminal mismatch rejected;
- expired assertion rejected;
- replayed assertion/event rejected;
- inactive credential/employee/terminal rejected.

### Attendance
- normal same-gym IN/OUT;
- Birkirkara IN → Marsa OUT closes one global session;
- Marsa IN next day works without re-enrollment;
- employee does not get simultaneous open sessions merely by moving gyms;
- duplicate event does not invert state;
- gym metadata does not alter worked-minute calculation.

### Automatic logout
- midnight automatic OUT leaves physical OUT gym/terminal null;
- alert is created/open;
- session visibly requires Super Admin review;
- every supported automatic logout reason creates an alert using the same contract;
- correction/resolution is audited;
- payroll snapshot/history remains correct after review/correction.

### UI separation
- member barcode still works unchanged;
- fingerprint does not feed member scanner;
- member modal remains open while staff attendance notification appears separately;
- dedicated kiosk has one biometric event owner only.

### Existing payroll regression
- normal day;
- Full Time public holiday;
- Part Time public holiday;
- historical rate change;
- historical employment-type change;
- manual correction;
- missing payroll history warning;
- PDF/Excel/email/reporting regression as applicable.

## 28. Production Rollout Gate

Before Production:

- cross-terminal global enrollment/matching capability proven on TEST hardware;
- threat/security review completed for biometric credential storage and assertion signing;
- data-protection handling documented;
- TEST migrations applied and verified;
- automated tests/CI green;
- physical test across at least two registered gym terminal contexts;
- global revocation tested;
- cross-gym IN/OUT tested;
- automatic logout alert/review tested;
- scheduler for automatic attendance jobs confirmed at the required frequency;
- rollback/recovery procedure documented;
- explicit Production approval obtained.

Vercel Preview's weaker scheduler configuration must never be silently treated as the Production scheduler if the feature requires a higher frequency.

## 29. Out of Scope

Unless separately approved, this phase does not add:

- member fingerprint access;
- face recognition;
- offline attendance queues;
- automatic payroll payment;
- gym-scoped employee attendance states;
- hidden per-terminal enrollment presented as global enrollment.

## 30. Implementation Gate

Implementation must follow the approved implementation plan task-by-task.

The first implementation task is the cross-terminal biometric capability proof. Failure of that proof is a stop condition, not permission to weaken the global-enrollment requirement.
