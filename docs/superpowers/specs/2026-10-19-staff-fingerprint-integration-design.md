# BestGymsMalta Staff Fingerprint Integration — Design

Date: 2026-10-19
Status: Written design for user review; product implementation must not begin until this spec is explicitly approved and an implementation plan is subsequently approved.
Depends on: `2026-10-06-staff-attendance-payroll-design.md`, current Phase 3 attendance/payroll implementation, existing Staff Portal terminal authentication, existing Punch Clock API and attendance state engine.

## 1. Purpose

Add the permanent FP100 fingerprint integration for BestGymsMalta staff attendance without changing the established attendance/payroll rules and without coupling staff biometrics to the member barcode/card system.

The fingerprint subsystem exists only to answer one question locally and securely:

> Which authorised BGM staff employee matched this fingerprint at this registered staff terminal?

After a local match, the existing BGM server remains authoritative for whether the event becomes Clock In, Clock Out, Duplicate Ignored, Inactive Employee, Inactive Terminal, Needs Attention, or an error.

This design formalises the already-proven hardware path and the approved permanent architecture.

## 2. Non-Negotiable Separation From Member Scanning

The member and staff hardware pipelines remain completely separate.

### Member system

Hardware: barcode / membership-card scanner.

Purpose:

- member lookup;
- member access;
- member gym check-in.

Existing `StaffGlobalScanner` behaviour remains a member-only concern.

Members must never:

- enrol fingerprints;
- use fingerprints for gym access;
- receive biometric identities;
- have biometric records created;
- interact with the staff fingerprint service.

### Staff system

Hardware: FP100 USB fingerprint reader.

Purpose:

- staff identification for Punch Clock;
- staff Clock In / Clock Out attendance only.

Fingerprint events must never enter the member barcode scanner queue, parser, modal state, input handling, or access-check logic.

The fingerprint implementation must not modify the member scanner into a dual-purpose scanner.

## 3. Verified Hardware Baseline

The physical device already tested is:

- FP100 USB Fingerprint Reader;
- ChipSailing driver family;
- Windows device name `ChipSailing Fingerprint UsbDriver`;
- VID/PID `USB\\VID_2541&PID_0236`;
- Windows Biometric Framework compatible;
- tested in BASIC sensor mode;
- private WinBio session successfully opened;
- temporary private biometric database successfully created;
- temporary fingerprint enrollment successfully committed;
- the same enrolled finger was subsequently identified to the same GUID;
- the temporary template, private sensor configuration, registration and biometric database file were deleted after the test.

Hardware feasibility is therefore complete and must not be repeated as part of normal implementation work.

The temporary hardware-test biometric GUID is not production data and must never be reused in application code, migrations, fixtures, staff records, or production documentation examples.

## 4. Chosen Architecture

The permanent architecture is:

`FP100 fingerprint reader`

→ `local BGM Windows biometric service`

→ `private Windows Biometric Framework database`

→ `local biometric GUID / opaque match identity`

→ `authorised BGM employee mapping`

→ `normalised biometric-match event`

→ `existing BGM Punch Clock web/server flow`

→ `/api/staff-punch-clock/punch`

→ `existing attendance state engine`

The browser does not read raw fingerprint frames and does not call WinBio directly.

The local Windows component is the only component that talks directly to `winbio.dll`.

The local Windows service performs biometric capture and matching. BGM web/Supabase stores only the metadata needed to map an authorised local biometric identity to a BGM employee and terminal context.

## 5. Source of Truth

The BGM staff employee ID remains the permanent authoritative employee identity.

A WinBio GUID is not the employee's primary identity.

The model must distinguish:

- BGM staff employee identity;
- fingerprint terminal/device identity;
- local biometric enrollment identity.

Conceptually:

`staff_employee_id` ↔ `biometric_terminal/device` ↔ `winbio_template_guid`

An employee may therefore have more than one local biometric enrollment over time or across terminals/gyms without receiving a different BGM employee identity.

## 6. Local Windows Biometric Service

A small Windows-local BGM service/bridge is required because the existing Staff Portal is browser-based and should not attempt direct private WinBio operations.

The service responsibilities are limited to:

- open and maintain the private BGM WinBio database for the configured terminal;
- detect the configured FP100 reader;
- enroll authorised staff fingerprints when instructed through an authenticated Super Admin enrollment flow;
- identify fingerprints locally;
- remove/revoke local biometric enrollment when instructed;
- convert a successful match into a normalised opaque identity event;
- communicate securely with the browser/BGM server integration layer;
- expose service/device health required by the Staff Portal;
- record only non-biometric operational logs.

The local service must not:

- handle member barcodes;
- access member records;
- calculate wages;
- decide Clock In vs Clock Out;
- choose arbitrary gyms;
- invent attendance while offline;
- upload raw biometric material.

## 7. Biometric Privacy Model

BGM web infrastructure and Supabase must not store:

- raw fingerprint images;
- raw sensor frames;
- fingerprint templates;
- WinBio database files;
- exported biometric template blobs.

The private Windows biometric layer stores and matches the biometric template locally.

Supabase may store only the minimum mapping and lifecycle metadata needed for BGM to understand an enrollment, for example:

- employee ID;
- BGM terminal ID;
- terminal/device installation identifier;
- opaque biometric enrollment reference / WinBio GUID where required for mapping;
- enrollment status;
- enrolled-at timestamp;
- enrolled-by Super Admin identity;
- revoked-at timestamp and revocation metadata where applicable;
- non-sensitive service/device version metadata where operationally useful.

Application, audit and local service logs must never contain fingerprint images, templates, WinBio database contents, or other reconstructable biometric material.

## 8. Multi-Gym / Multi-Terminal Strategy

The permanent design must work across multiple BGM gyms and must not assume one reception PC forever.

Fingerprint templates remain local to each private biometric installation. They are not synchronised through Supabase merely to avoid re-enrollment.

Therefore:

- an employee can have multiple active local biometric enrollments, each associated with a specific registered terminal/device installation;
- the same employee may need enrollment at more than one gym/terminal if they are expected to punch there;
- replacement PCs/readers may require re-enrollment;
- terminal/device replacement must not change the employee's BGM identity or historical attendance;
- Super Admin must be able to see enrollment status by employee and terminal/device;
- revoking or deactivating an employee must stop that employee from creating valid new punches even if stale local biometric material still exists temporarily.

Server-side employee/terminal validation remains the final safety boundary.

## 9. Terminal Identity and Authority

A browser or local biometric event must not be trusted to supply arbitrary:

- gym ID;
- employee authority;
- punch timestamp authority;
- punch direction.

The existing registered Punch Clock terminal/session context remains authoritative for terminal identity and gym.

The biometric layer proves only the matched staff identity plus a unique source event reference and local match time.

The server then determines:

- whether the terminal is valid and active;
- the terminal's gym;
- whether the mapped employee exists and is active;
- whether the event is accepted;
- Clock In vs Clock Out;
- canonical/effective punch time under the existing attendance rules;
- duplicate handling;
- resulting attendance and payroll consequences.

## 10. Reuse the Existing Punch Clock API

Do not create a second attendance implementation.

The current `/api/staff-punch-clock/punch` route already:

- authenticates the staff terminal;
- resolves a biometric match through the biometric adapter contract;
- validates the normalised match;
- generates an idempotent event key scoped to terminal and adapter event ID;
- calls the existing attendance state engine;
- handles inactive employee, inactive terminal, invalid request and duplicate outcomes;
- returns employee confirmation data, gym, effective time and daily minutes.

The permanent fingerprint bridge should satisfy this existing contract rather than bypass it.

Any adapter changes must remain narrow and must not duplicate payroll logic inside the local Windows service or browser.

## 11. Normalised Biometric Match Contract

The web-facing biometric event should contain only the minimum required non-template identity data.

The existing server contract concept is preserved:

- `employeeId`: the authoritative mapped BGM employee ID;
- `adapterEventId`: a unique event ID generated for the local match;
- `matchedAt`: the local match timestamp, subject to server validation and existing attendance rules.

No raw fingerprint data or template data is included.

The browser-level event remains:

`bgm:staff-biometric-match`

Its detail payload must be suitable for the existing biometric adapter and Punch Clock endpoint.

The implementation plan must define the exact authenticated transport from the local Windows service to the browser/event bridge, but that transport must preserve this minimal contract and security boundary.

## 12. Browser Integration Components

The staff fingerprint integration remains physically and logically separate from `StaffGlobalScanner`.

The intended web architecture is:

- existing `StaffGlobalScanner` — member barcode/card only;
- new `StaffGlobalBiometricBridge` — staff biometric match integration only;
- existing `StaffPunchClockKiosk` — dedicated Punch Clock route owner where applicable.

`StaffGlobalBiometricBridge` may be mounted in the staff layout alongside `StaffGlobalScanner`, but never inside it.

The two components must not share scanner input queues, editable-field protections, member access modal state, or parsing rules.

## 13. Event Ownership and Double-Punch Prevention

`StaffPunchClockKiosk` already listens for `bgm:staff-biometric-match` and submits it to the existing Punch Clock endpoint.

A future global biometric bridge must not process the same fingerprint simultaneously on `/staff/punch-clock`.

Chosen lowest-risk ownership rule:

- on `/staff/punch-clock`, `StaffPunchClockKiosk` is the sole biometric event owner;
- on other `/staff` pages, `StaffGlobalBiometricBridge` owns biometric-match events;
- the global bridge must explicitly disable/suppress its punch submission on the dedicated Punch Clock route.

This rule must be covered by automated tests because duplicate browser handlers could otherwise generate two server requests for one scan.

Server idempotency remains a second safety layer, not a substitute for correct event ownership.

## 14. Staff-Portal Attendance Notification

On staff pages other than the dedicated kiosk, a successful fingerprint punch should display a compact attendance notification independent of member access UI.

Success states:

- `CLOCKED IN`;
- `CLOCKED OUT`.

The notification should show where available:

- employee photo;
- employee name;
- exact effective punch time;
- gym/terminal identity;
- daily accumulated worked time where already returned by the server.

Other states include:

- duplicate ignored;
- fingerprint not recognised;
- inactive employee;
- inactive terminal;
- service/device unavailable;
- needs attention;
- punch error.

Success/duplicate notices may auto-dismiss after a short interval. Errors requiring action should remain visible long enough to be understood and retried appropriately.

## 15. Coexistence With Member Access Modal

A fingerprint scan must never close, replace, mutate, or feed data into an open member access modal.

If a member access modal is open while a staff employee touches the FP100:

- the member modal remains unchanged;
- the staff attendance result appears in its own smaller notification layer;
- no fingerprint-derived text/digits are injected into the member flow;
- neither scanner blocks the other unless an actual hardware/OS limitation is proven later.

The member access workflow remains authoritative for member interactions; the biometric notification remains a separate staff-attendance surface.

## 16. Super Admin Enrollment Flow

Fingerprint enrollment is controlled from Super Admin staff management only.

Recommended flow:

1. Super Admin opens an employee record.
2. Super Admin chooses `Enroll fingerprint`.
3. BGM confirms the target employee and selected/connected registered biometric terminal/device.
4. The authenticated local Windows service starts a private WinBio enrollment session.
5. The service guides the required capture sequence.
6. Enrollment is committed locally only after successful biometric capture.
7. BGM stores only the approved mapping/reference metadata.
8. The enrollment action is written to the central audit trail.
9. UI shows the resulting enrollment status.

Required states include:

- Enrolled;
- Not enrolled;
- Re-enrollment required;
- Device/service unavailable;
- Enrollment failed.

Enrollment must fail closed: an incomplete or failed capture must not create an active BGM enrollment mapping.

## 17. Remove / Revoke Enrollment

Super Admin must have `Remove fingerprint enrollment` for a selected employee/terminal mapping.

Revocation must:

- remove the local biometric template where the target device/service is reachable;
- mark/revoke the BGM mapping centrally;
- write an audit entry identifying employee, terminal/device, actor, timestamp and reason/action context;
- prevent new accepted punches through that enrollment.

If the local device is unavailable during central revocation, BGM must still mark the mapping revoked so the server refuses new attendance from it. The UI should then show that local cleanup is pending and require device cleanup/re-enrollment before the terminal is considered fully healthy.

Historical attendance is never deleted by enrollment revocation.

## 18. Employee Deactivation

Employee deactivation must immediately prevent new accepted attendance punches server-side.

Local template cleanup should also be attempted/queued operationally, but successful server deactivation cannot depend on local cleanup being online at that moment.

Reactivating an employee must not silently reactivate an obsolete/revoked fingerprint mapping. Enrollment status must be explicitly valid before biometric punching resumes.

## 19. Terminal / Device Replacement and Recovery

Replacement hardware or a rebuilt Windows installation may invalidate the local private biometric database.

Recovery strategy:

- register/provision the replacement installation as an authorised BGM biometric terminal/device;
- mark previous local mappings as replaced/re-enrollment required where appropriate;
- retain all historical punch/attendance records linked to the original terminal;
- re-enroll required employees locally on the new installation;
- never migrate raw templates through Supabase;
- retire/revoke old device credentials;
- make device replacement visible in audit history.

A failed local database does not justify guessing identities or attendance.

## 20. Local Service Authentication and Transport

Communication between the local Windows service and BGM must be authenticated and narrowly scoped.

The implementation plan must choose a concrete transport that supports the required browser/service integration safely on Windows. Regardless of transport choice, the following requirements are fixed:

- only an authorised BGM local service/device can emit accepted biometric-match events;
- credentials/secrets are not embedded in browser-visible source where avoidable;
- terminal credentials remain scoped to their registered terminal;
- replayed match events are rejected through unique event IDs/idempotency;
- the browser cannot forge arbitrary employee IDs and obtain a valid punch merely by dispatching a JavaScript event;
- the server independently validates terminal, employee and mapping state;
- device/service health can be surfaced without exposing biometric material.

The browser CustomEvent is an internal UI integration mechanism, not the security boundary.

## 21. Offline Behaviour

Version 1 remains online-only.

If internet, BGM API, terminal authentication or required service communication is unavailable:

- no attendance record is guessed;
- no local punch is silently treated as final;
- no queued offline attendance is later replayed automatically;
- the UI clearly reports that the punch was not recorded;
- Super Admin manual punch fallback remains the recovery mechanism with mandatory reason and audit trail.

Biometric identification may technically occur locally while offline, but it must not be presented as a successful BGM Clock In/Out unless the BGM server has accepted the punch.

## 22. Failure Behaviour

Failures must be explicit and fail closed.

Examples:

### Fingerprint not recognised

- no attendance event;
- show `Fingerprint not recognised`;
- allow a fresh attempt.

### Reader/service unavailable

- no attendance event;
- show hardware/service unavailable;
- do not fall back to member barcode logic.

### Inactive employee

- server rejects punch;
- no new valid work session/punch;
- show attendance unavailable / contact manager.

### Inactive terminal

- server rejects punch;
- no attendance record;
- terminal requires Super Admin intervention.

### Invalid/revoked mapping

- server rejects event;
- no attendance record;
- show re-enrollment/attention state where appropriate.

### Network/API failure

- do not claim `CLOCKED IN` or `CLOCKED OUT`;
- show connection failure;
- manual fallback is available to Super Admin.

### Duplicate event

- rely on the existing idempotent event key / duplicate handling;
- display `Punch already recorded` / duplicate ignored;
- do not reverse the employee's attendance state.

## 23. Audit Requirements

Central audit must cover at least:

- biometric enrollment created;
- biometric enrollment removed/revoked;
- re-enrollment required;
- device/terminal registration relevant to biometrics;
- device/terminal replacement or retirement;
- mapping changes;
- Super Admin actor;
- employee;
- terminal/device;
- timestamp;
- outcome and non-sensitive reason/context.

Audit records must never include raw biometric data or templates.

Normal attendance audit remains governed by the existing attendance subsystem and immutable source-event design.

## 24. Logging Requirements

Local service logs may include:

- service start/stop;
- reader detected/not detected;
- private database opened/unavailable;
- enrollment started/completed/failed using BGM employee/mapping references where safe;
- match success/failure using opaque identifiers;
- communication/authentication failure;
- software/device version.

Logs must not include:

- fingerprint images;
- sensor frames;
- fingerprint templates;
- WinBio database exports;
- secrets/credentials;
- unnecessary personally identifying staff details.

Retention should be operationally limited and not treated as an alternate biometric store.

## 25. Existing Payroll and Attendance Rules Remain Unchanged

This integration does not redesign Phase 3 payroll.

The following existing rules remain authoritative:

- exact-minute attendance calculations;
- no special overtime premium;
- effective-dated hourly rates;
- Full Time / Part Time employment history;
- public-holiday multipliers by employment type;
- historical payroll preservation;
- manual Super Admin fallback with mandatory reason;
- audit-preserving corrections;
- midnight Malta auto-clock-out and warning behaviour already implemented;
- existing reporting/timesheet requirements.

The local biometric service must never calculate or snapshot payroll.

## 26. Database / Mapping Design Direction

The implementation plan should add a dedicated biometric enrollment/mapping entity rather than placing a single fingerprint GUID directly on `bgm_staff_employees`.

The mapping must support multiple enrollments per employee and lifecycle history.

Required concepts include:

- unique mapping ID;
- employee ID;
- terminal/device installation ID;
- local biometric identity reference;
- active/revoked/re-enrollment-required status;
- enrollment timestamps;
- created/enrolled-by audit identity;
- revocation/replacement metadata;
- uniqueness rules preventing accidental duplicate active mapping for the same local biometric identity;
- indexes needed for secure lookup and Super Admin status views.

The exact table/column names belong in the implementation plan, but the model must preserve the one-employee-to-many-device-enrollments relationship.

## 27. Service-to-Employee Mapping Validation

A local match must not be accepted solely because the local service claims an employee ID.

Server-side validation should be able to verify that:

- the biometric mapping exists;
- it is active;
- it belongs to the authenticated terminal/device context;
- it maps to the stated employee;
- the employee is active;
- the terminal is active.

If the implementation uses a local opaque enrollment reference rather than directly sending `employeeId`, the server should resolve that reference to the employee. If the existing adapter contract continues to expose `employeeId`, the adapter/server must still validate the corresponding authorised mapping before attendance is recorded.

This prevents an arbitrary browser-generated CustomEvent from being treated as biometric proof.

## 28. Test Strategy

All fingerprint integration work is TEST-first and must not touch Production until explicitly approved.

TEST Supabase project:

`vlvyqdjhzdcxatilbdiv`

Production project remains untouched during design and implementation verification.

Required tests include at minimum:

### Local service / hardware adapter

- configured FP100 reader detected;
- private WinBio database opens;
- enrollment succeeds through authorised flow;
- enrollment failure leaves no active mapping;
- enrolled finger identifies to expected local mapping;
- unknown finger returns no match;
- revocation removes/invalidates enrollment;
- reader unavailable returns explicit failure;
- no biometric material appears in logs or web payloads.

### Server mapping/security

- valid terminal + valid active mapping + active employee accepted;
- mapping from a different terminal/device rejected;
- revoked mapping rejected;
- inactive employee rejected;
- inactive terminal rejected;
- forged employee ID / browser event without valid mapping rejected;
- repeated adapter event ID remains idempotent;
- stale/replayed event is safely rejected/ignored under defined validation rules.

### Browser ownership

- `/staff/punch-clock` is handled only by `StaffPunchClockKiosk`;
- other `/staff` pages are handled by `StaffGlobalBiometricBridge`;
- one biometric scan causes at most one punch request per browser flow;
- member `StaffGlobalScanner` remains untouched by biometric events;
- an open member modal remains open when a staff biometric result appears.

### Attendance integration

- valid first punch clocks in;
- next valid punch clocks out;
- duplicate scan does not immediately reverse attendance state;
- cross-gym attendance remains governed by server terminal context;
- returned employee photo/name/gym/time/daily minutes display correctly;
- network/service failure creates no false success state.

### Enrollment lifecycle

- Super Admin-only enrollment;
- Super Admin-only removal/revocation;
- enrollment audit written;
- revocation audit written;
- employee deactivation prevents new punches;
- device replacement marks affected enrollment status correctly;
- historical attendance remains unchanged after re-enrollment/device replacement.

## 29. Production Rollout Strategy

Production rollout must be staged.

1. Complete implementation and automated tests on `feature/staff-attendance-payroll`.
2. Apply schema changes to TEST only.
3. Install/configure the local Windows biometric service on a controlled TEST/reception PC.
4. Provision a TEST Punch Clock terminal/device identity.
5. Enroll test staff only.
6. Verify end-to-end fingerprint → local match → authenticated mapping → existing Punch Clock API → attendance result.
7. Verify member barcode scanning simultaneously remains unaffected.
8. Verify enrollment removal and device/service recovery.
9. Complete Phase 3 CI and preview verification.
10. Obtain explicit Production approval before applying Production schema/configuration or enrolling real staff.

Production biometric enrollment must not begin implicitly as part of deployment.

## 30. Recovery and Support

Operational support states must be visible enough for Super Admin to distinguish:

- fingerprint not enrolled;
- enrolled and healthy;
- re-enrollment required;
- local service unavailable;
- reader unavailable;
- terminal inactive;
- mapping revoked;
- server/network unavailable.

Recovery actions should direct Super Admin to the appropriate remedy rather than encouraging repeated blind scans.

No recovery action may silently bypass biometric identity validation and create a punch under an assumed employee.

## 31. Out of Scope

Unless separately approved, this fingerprint integration does not include:

- member fingerprint access;
- biometric member enrollment;
- raw biometric storage in Supabase;
- central synchronisation of fingerprint templates;
- offline attendance queues/synchronisation;
- facial recognition;
- fingerprint-based Staff Portal login/authentication;
- replacing member barcode/card scanners;
- payroll calculation inside the local Windows service;
- redesign of existing attendance/payroll rules;
- Production rollout during the design/TEST stage.

## 32. Implementation Gate

This design document is the architectural gate for the permanent staff fingerprint subsystem.

After this spec is committed:

1. self-review the spec for placeholders, contradictions, ambiguity, unnecessary scope, accidental member biometric functionality and privacy issues;
2. present the written spec to the user for explicit review/approval;
3. only after written-spec approval, invoke the Superpowers `writing-plans` skill;
4. create the detailed implementation plan;
5. obtain user approval of that plan and execution method;
6. only then begin product implementation.

No product code is authorised by the existence of this document alone.
