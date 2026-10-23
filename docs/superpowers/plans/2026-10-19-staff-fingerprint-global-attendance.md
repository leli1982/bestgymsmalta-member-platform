# Staff Fingerprint Global Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one-time global FP100 staff fingerprint enrollment across authorised BGM gym terminals while keeping attendance state employee-global, recording each physical punch location, and flagging every automatic logout for Super Admin review.

**Architecture:** Keep member barcode scanning and staff biometrics completely separate. A native Windows biometric service owns the FP100 device and biometric material, produces short-lived signed match assertions, and the existing web Punch Clock API verifies those assertions before calling the existing employee-global attendance engine. The first implementation task is a hard capability proof that one enrollment can be matched on a second authorised Windows terminal; if that proof fails, implementation stops for architecture review and must not fall back to per-gym enrollment.

**Tech Stack:** Next.js 16 / React / TypeScript, Supabase PostgreSQL + service-role server access, Node test runner contract tests, Windows 11 + FP100 / ChipSailing biometric stack, .NET 8 native Windows service/prototype, signed assertions using an asymmetric terminal/service key stored outside browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-10-19-staff-fingerprint-integration-design.md`

## Global Constraints

- Work on `feature/staff-attendance-payroll` and TEST Supabase `vlvyqdjhzdcxatilbdiv` first; Production `jsuolemirhivqhjbjetv` remains untouched until a separate release approval.
- A staff employee enrolls once for BGM, not once per gym or terminal.
- Any authorised active Punch Clock terminal may identify any active globally enrolled employee.
- Attendance state belongs to the employee globally; gym must never be part of the open-session lookup key.
- Clock In gym/terminal and Clock Out gym/terminal are recorded independently and may differ within one work session.
- Worked minutes and payroll are derived from the employee session timestamps, not from gym assignment or gym changes.
- `home_gym_id` is profile/assignment metadata only and must not restrict punching.
- Every automatic/system logout creates a visible Super Admin review item and never invents a physical OUT gym or terminal.
- Existing Malta-midnight safeguard remains 00:00 Europe/Malta and must remain historically auditable/correctable.
- Member `StaffGlobalScanner` remains barcode/card-only; member flows never receive biometric events or biometric data.
- Browser JavaScript never receives raw fingerprint images, templates, WinBio databases, or reconstructable biometric material.
- Raw fingerprint images/frames are never persisted.
- No offline punch queue or silent replay in v1; attendance is successful only after server acceptance.
- A browser `CustomEvent` is not a security boundary; an employee ID supplied by browser JavaScript is never sufficient to create attendance.
- The authenticated terminal is authoritative for the punch gym/location.
- Biometric credential revocation is global and employee deactivation independently blocks attendance.
- Historical attendance/payroll records survive credential revocation, re-enrollment, device replacement, employee status changes, rate changes and employment-type changes.
- Do not weaken the Production midnight scheduler to the Preview daily workaround; choose a real hourly scheduler before Production rollout.

## Review Focus

1. **Cross-terminal proof passes locally but identity is accidentally terminal-scoped in application data.** Task 2 schema tests must prove there is no gym/terminal foreign key on the global biometric credential and Task 5 API tests must accept the same credential from two different active terminals.
2. **A valid signed assertion is replayed or submitted from a different terminal.** Task 4 tests must reject expired assertions, duplicate nonces/event IDs, wrong-terminal assertions and invalid signatures without changing attendance state.
3. **Cross-gym Clock Out accidentally creates a second session or uses the OUT gym to find the open session.** Task 3 tests must prove Birkirkara IN → Marsa OUT closes exactly one employee session and preserves both locations.
4. **Automatic logout looks like a physical punch or disappears after correction.** Task 6 tests must prove `clock_out_gym_id`/`clock_out_terminal_id` stay null, a review alert is opened, and both original automatic evidence and correction audit remain available.
5. **Member barcode and staff fingerprint event handlers interfere on shared Staff Portal pages.** Task 7 tests must prove fingerprint results never enter member scanner/modal state and the dedicated Punch Clock has exactly one biometric event owner.

---

## File Map

### New native biometric capability/service area
- Create `native/Bgm.StaffBiometricService/Bgm.StaffBiometricService.csproj` — .NET 8 Windows-native service/prototype project.
- Create `native/Bgm.StaffBiometricService/Biometric/IPortableBiometricEngine.cs` — engine abstraction proven by the capability gate.
- Create `native/Bgm.StaffBiometricService/Biometric/Fp100CapabilityProbe.cs` — enrollment-on-A/match-on-B proof harness and machine-readable result.
- Create `native/Bgm.StaffBiometricService/Biometric/Fp100PortableBiometricEngine.cs` — implementation selected only after the capability gate passes.
- Create `native/Bgm.StaffBiometricService/Security/MatchAssertionSigner.cs` — short-lived signed assertion creation using the local private key.
- Create `native/Bgm.StaffBiometricService/Api/LoopbackMatchApi.cs` — loopback-only browser bridge exposing signed assertions and non-sensitive health only.
- Create `native/Bgm.StaffBiometricService/Program.cs` — service composition/startup.
- Create `native/Bgm.StaffBiometricService.Tests/...` — native unit/integration tests for signing, expiry, no biometric logging, and the engine contract.
- Create `docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md` — evidence from the two-terminal hardware gate; no biometric material.

### Supabase / server
- Create `supabase/migrations/20261019_120000_staff_global_biometrics.sql` — global biometric credential lifecycle, terminal assertion public keys, replay records, and generic automatic-attendance alerts.
- Modify `lib/staffBiometricAdapter.ts` — replace disabled placeholder contract with verified assertion contract and error taxonomy; no direct employee ID trust.
- Create `lib/staffBiometricAssertion.ts` — assertion parsing, canonical payload, signature verification, expiry/skew and nonce validation helpers.
- Modify `app/api/staff-punch-clock/punch/route.ts` — verify signed assertion against authenticated terminal and active global credential before `recordStaffPunch`.
- Create `app/api/system/staff-employees/[employeeId]/biometric/route.ts` — Super Admin read/enroll-status/revoke lifecycle endpoint; never returns biometric material.
- Create `app/api/system/staff-biometric/enrollment-command/route.ts` — issues short-lived authorised enrollment command for one selected employee and enrollment station.
- Create `app/api/system/staff-attendance/automatic-alerts/route.ts` — Super Admin list/filter of automatic clock-out exceptions.
- Modify `lib/staffAttendanceServer.ts` — expose generic automatic-attendance review/correction inputs without changing employee-global punch semantics.
- Modify `lib/staffMidnightAutoClockOut.ts` — use generic automatic-attendance reason contract.
- Create `lib/staffAutomaticAttendance.ts` — common reason/status labels and alert DTOs for all system-generated clock-outs.
- Modify the next additive attendance migration rather than editing already-applied TEST migrations for new behaviour.

### Staff Portal UI
- Create `components/staff/StaffGlobalBiometricBridge.tsx` — general `/staff` loopback listener/submitter, disabled on `/staff/punch-clock`.
- Modify `app/staff/layout.tsx` — mount biometric bridge alongside, not inside, `StaffGlobalScanner`.
- Modify `components/staff/StaffPunchClockKiosk.tsx` — consume signed native-service assertion events and explicit service health states.
- Modify `components/staff/StaffEmployeeDetail.tsx` — Super Admin global fingerprint status, enroll, revoke and re-enroll controls.
- Modify `components/staff/StaffEmployeesAdmin.tsx` only if required to surface global enrollment state in the employee list.
- Modify `components/staff/StaffTimesheetsAdmin.tsx` — automatic logout review indicator/filter/action.

### Tests
- Create `tests/staff-global-biometric-schema.test.mjs`.
- Create `tests/staff-biometric-assertion.test.mjs`.
- Modify `tests/staff-punch-endpoint-contract.test.mjs`.
- Modify `tests/staff-attendance-core.test.mjs` and/or create `tests/staff-cross-gym-attendance-contract.test.mjs`.
- Modify `tests/staff-midnight-auto-clock-out-contract.test.mjs` and `tests/staff-midnight-auto-clock-out.test.mjs`.
- Create `tests/staff-automatic-attendance-alerts-contract.test.mjs`.
- Create `tests/staff-global-biometric-ui-contract.test.mjs`.
- Modify `tests/staff-punch-kiosk-ui-contract.test.mjs`.
- Extend TEST fixture/verification script used for Phase 3 to include cross-gym and automatic-review scenarios.

---

### Task 1: Prove FP100 cross-terminal global biometric capability

**Files:**
- Create: `native/Bgm.StaffBiometricService/Bgm.StaffBiometricService.csproj`
- Create: `native/Bgm.StaffBiometricService/Biometric/IPortableBiometricEngine.cs`
- Create: `native/Bgm.StaffBiometricService/Biometric/Fp100CapabilityProbe.cs`
- Create: `native/Bgm.StaffBiometricService.Tests/Biometric/Fp100CapabilityProbeTests.cs`
- Create: `docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md`

**Interfaces:**
- Consumes: FP100/ChipSailing hardware already proven to work locally with Windows Biometric Framework BASIC mode.
- Produces: `IPortableBiometricEngine` with `EnrollAsync(EmployeeBiometricSubject subject, CancellationToken ct)`, `IdentifyAsync(CancellationToken ct)`, `RevokeAsync(string credentialId, CancellationToken ct)` and a written PASS/FAIL hardware evidence record.

- [ ] **Step 1: Write the failing native contract tests**

Create tests asserting that an engine can produce a non-biometric `credentialId`, identify the same test subject through a second engine/terminal context, distinguish no-match from device/service failure, and revoke the credential so the second terminal no longer returns an accepted identity.

- [ ] **Step 2: Run the native tests and verify RED**

Run: `dotnet test native/Bgm.StaffBiometricService.Tests/Bgm.StaffBiometricService.Tests.csproj`
Expected: FAIL because the engine/probe implementation does not exist.

- [ ] **Step 3: Implement only the two-terminal capability probe**

Use the supported FP100/ChipSailing mechanism discovered on the actual BGM hardware. Do not persist raw images. The output must record only capability/result metadata and opaque credential IDs; never write template bytes or samples into the evidence document/logs.

- [ ] **Step 4: Execute the physical gate on authorised TEST terminals A and B**

Acceptance: enroll once on A; a fresh capture on B resolves the same test employee credential; no-match is distinguishable; global revocation prevents a later accepted B match.

If any acceptance item fails, stop this plan immediately and return to architecture review. Do not continue with per-terminal enrollment.

- [ ] **Step 5: Save the evidence and rerun native tests**

Expected: PASS and evidence document explicitly states the tested provider/format/version, terminal A/B environment, revocation result, and that no raw biometric material was retained.

- [ ] **Step 6: Commit**

```bash
git add native/Bgm.StaffBiometricService native/Bgm.StaffBiometricService.Tests docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md
git commit -m "test: prove global FP100 biometric matching"
```

### Task 2: Add global biometric credential and assertion-security schema on TEST

**Files:**
- Create: `supabase/migrations/20261019_120000_staff_global_biometrics.sql`
- Create: `tests/staff-global-biometric-schema.test.mjs`

**Interfaces:**
- Consumes: Task 1 selected portable/global matching mechanism.
- Produces: server-only global credential rows keyed to `bgm_staff_employees.id`, terminal public-key metadata, one-time assertion nonce/replay storage, and generic automatic-attendance alert records.

- [ ] **Step 1: Write failing schema contract tests**

Assert that the new global biometric credential has `employee_id`, opaque credential ID/status/version/lifecycle fields and **no gym/terminal scope**; terminal signing public key is attached to `bgm_staff_terminals` or a dedicated terminal-key table; replay nonce/event IDs are unique; automatic alert records reference employee/session/reason/review status; RLS/revokes keep all tables server-only.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/staff-global-biometric-schema.test.mjs`
Expected: FAIL because the additive migration is absent.

- [ ] **Step 3: Implement the additive migration**

Do not rewrite `20261006_120000_staff_attendance_payroll.sql` or already-applied TEST migrations. Reuse/migrate `bgm_staff_biometrics` into the global lifecycle contract without storing raw fingerprint images. If the proven mechanism requires encrypted portable template material, store only encrypted ciphertext plus format/version metadata and keep it service-role-only.

- [ ] **Step 4: Apply migration to TEST only and inspect constraints**

Expected: migration succeeds on `vlvyqdjhzdcxatilbdiv`; existing employees, sessions, payroll segments and terminals remain intact; Production remains unchanged.

- [ ] **Step 5: Run schema tests and relevant existing attendance schema tests**

Run: `node --test tests/staff-global-biometric-schema.test.mjs tests/staff-attendance-schema.test.mjs tests/staff-punch-state-contract.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261019_120000_staff_global_biometrics.sql tests/staff-global-biometric-schema.test.mjs
git commit -m "feat: add global staff biometric schema"
```

### Task 3: Pin employee-global cross-gym attendance semantics

**Files:**
- Modify: `supabase/migrations/20261015_121000_staff_punch_state.sql` only in tests/reference if not yet applied locally; otherwise add any required fix in the new 20261019 additive migration.
- Modify: `lib/staffAttendanceServer.ts`
- Create: `tests/staff-cross-gym-attendance-contract.test.mjs`
- Modify: `tests/staff-attendance-core.test.mjs`

**Interfaces:**
- Consumes: existing `recordStaffPunch(input: RecordStaffPunchInput): Promise<StaffPunchResult>`.
- Produces: proven invariant that open-session lookup is `employee_id` only and physical punch gym is independently recorded at each boundary.

- [ ] **Step 1: Write failing cross-gym tests**

Cover: Birkirkara IN 08:03 → Marsa OUT 16:12 closes one session with 489 worked minutes; IN and OUT gym/terminal IDs differ; no second session is created; home gym does not affect acceptance; a simultaneous second terminal punch is serialized/idempotent for the employee.

- [ ] **Step 2: Run tests and verify the new coverage state**

Run: `node --test tests/staff-cross-gym-attendance-contract.test.mjs tests/staff-attendance-core.test.mjs`
Expected: RED if any gym-scoped assumption remains; otherwise the new tests may pass immediately, proving the existing SQL already satisfies the corrected requirement.

- [ ] **Step 3: Make the minimal attendance change only if the tests expose a defect**

The open-session query must remain equivalent to `where employee_id = p_employee_id and clock_out_at is null and status <> 'void'`; do not add gym predicates.

- [ ] **Step 4: Run punch-state and payroll regression tests**

Run: `node --test tests/staff-cross-gym-attendance-contract.test.mjs tests/staff-punch-state-contract.test.mjs tests/staff-attendance-historical-preservation-contract.test.mjs tests/staff-timesheet-report.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/staffAttendanceServer.ts supabase/migrations/20261019_120000_staff_global_biometrics.sql tests/staff-cross-gym-attendance-contract.test.mjs tests/staff-attendance-core.test.mjs
git commit -m "test: lock cross-gym employee attendance state"
```

### Task 4: Implement signed biometric assertions and replay protection

**Files:**
- Create: `lib/staffBiometricAssertion.ts`
- Modify: `lib/staffBiometricAdapter.ts`
- Create: `tests/staff-biometric-assertion.test.mjs`
- Modify: `tests/staff-punch-endpoint-contract.test.mjs`

**Interfaces:**
- Consumes: Task 2 credential + terminal-key schema.
- Produces: `VerifiedBiometricAssertion { employeeId, biometricCredentialId, terminalId, adapterEventId, matchedAt, issuedAt, expiresAt, protocolVersion }` from `verifyStaffBiometricAssertion(input, context)`; throws typed errors for invalid signature, expired, wrong terminal, revoked credential, replayed event and malformed payload.

- [ ] **Step 1: Write failing assertion tests**

Pin valid signature acceptance plus invalid signature, wrong terminal ID, expired assertion, timestamp outside allowed skew, revoked credential, inactive employee, duplicate nonce/event ID and malformed payload.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/staff-biometric-assertion.test.mjs tests/staff-punch-endpoint-contract.test.mjs`
Expected: FAIL because trusted signed assertions are not implemented.

- [ ] **Step 3: Implement canonical assertion verification**

The verifier must derive the trusted employee from the verified active credential relationship, not from an untrusted browser employee field. Keep private signing material outside the web app/database; database stores only the terminal/service public verification material required by the proven mechanism.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/staff-biometric-assertion.test.mjs tests/staff-punch-endpoint-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/staffBiometricAssertion.ts lib/staffBiometricAdapter.ts tests/staff-biometric-assertion.test.mjs tests/staff-punch-endpoint-contract.test.mjs
git commit -m "feat: verify staff biometric assertions"
```

### Task 5: Secure the Punch Clock endpoint for global credentials on any authorised terminal

**Files:**
- Modify: `app/api/staff-punch-clock/punch/route.ts`
- Modify: `tests/staff-punch-endpoint-contract.test.mjs`
- Modify: `tests/staff-terminal-auth.test.mjs`

**Interfaces:**
- Consumes: `verifyStaffBiometricAssertion(...)` from Task 4 and `recordStaffPunch(...)` from the existing attendance server.
- Produces: Punch Clock request path where terminal authentication supplies location and the verified global credential supplies employee identity.

- [ ] **Step 1: Add failing endpoint tests**

Assert: same active global credential is accepted from terminal A and terminal B; request body gym is ignored/rejected; assertion terminal ID must equal authenticated terminal ID; forged browser employee ID is ignored/rejected; replay does not toggle attendance; revoked credential and inactive terminal fail closed.

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `node --test tests/staff-punch-endpoint-contract.test.mjs tests/staff-terminal-auth.test.mjs`
Expected: FAIL on the new security expectations.

- [ ] **Step 3: Replace placeholder adapter trust with verified assertion trust**

Call terminal auth first, verify assertion second, then call `recordStaffPunch` with `employeeId` from the verified credential, `terminalId` from terminal auth, and event key `biometric:${terminalId}:${adapterEventId}`. Never accept employee or gym authority from the browser request body.

- [ ] **Step 4: Run endpoint + cross-gym tests**

Run: `node --test tests/staff-punch-endpoint-contract.test.mjs tests/staff-terminal-auth.test.mjs tests/staff-cross-gym-attendance-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/staff-punch-clock/punch/route.ts tests/staff-punch-endpoint-contract.test.mjs tests/staff-terminal-auth.test.mjs
git commit -m "feat: accept global biometric punches securely"
```

### Task 6: Generalize every automatic logout into a Super Admin review exception

**Files:**
- Create: `lib/staffAutomaticAttendance.ts`
- Modify: `lib/staffMidnightAutoClockOut.ts`
- Modify: `lib/staffAttendanceServer.ts`
- Create: `app/api/system/staff-attendance/automatic-alerts/route.ts`
- Modify: `components/staff/StaffTimesheetsAdmin.tsx`
- Modify: `tests/staff-midnight-auto-clock-out.test.mjs`
- Modify: `tests/staff-midnight-auto-clock-out-contract.test.mjs`
- Create: `tests/staff-automatic-attendance-alerts-contract.test.mjs`

**Interfaces:**
- Produces: `AutomaticAttendanceReason`, `AutomaticAttendanceAlert`, generic review statuses `open | resolved`, and server list/review path for Super Admin.
- Midnight remains reason `midnight_auto_clock_out`; future system reasons use the same alert path.

- [ ] **Step 1: Write failing automatic-alert tests**

Assert every system clock-out opens an alert; midnight event leaves physical OUT gym/terminal null; alert contains employee/session/original IN location/automatic OUT time/reason/review status; correcting the session requires reason and does not delete the original system punch/audit evidence.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/staff-midnight-auto-clock-out.test.mjs tests/staff-midnight-auto-clock-out-contract.test.mjs tests/staff-automatic-attendance-alerts-contract.test.mjs`
Expected: FAIL until generic alert creation/listing is implemented.

- [ ] **Step 3: Implement generic automatic attendance alerts**

Reuse the existing midnight 00:00 Europe/Malta calculation. Do not create a physical OUT terminal/gym for a system action. Keep payroll snapshot/rebuild behaviour from the existing Phase 3 correction rules.

- [ ] **Step 4: Add Super Admin timesheet alert/filter UI**

Show unresolved automatic logout exceptions distinctly with reason and a correction/review path; do not expose this to ordinary gym staff.

- [ ] **Step 5: Run midnight, correction and timesheet regressions**

Run: `node --test tests/staff-midnight-auto-clock-out.test.mjs tests/staff-midnight-auto-clock-out-contract.test.mjs tests/staff-automatic-attendance-alerts-contract.test.mjs tests/staff-attendance-correction-contract.test.mjs tests/staff-timesheets-ui-contract.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/staffAutomaticAttendance.ts lib/staffMidnightAutoClockOut.ts lib/staffAttendanceServer.ts app/api/system/staff-attendance/automatic-alerts/route.ts components/staff/StaffTimesheetsAdmin.tsx tests/staff-midnight-auto-clock-out.test.mjs tests/staff-midnight-auto-clock-out-contract.test.mjs tests/staff-automatic-attendance-alerts-contract.test.mjs
git commit -m "feat: flag every automatic staff logout"
```

### Task 7: Build native service signing/loopback bridge and isolate it from member scanning

**Files:**
- Create: `native/Bgm.StaffBiometricService/Biometric/Fp100PortableBiometricEngine.cs`
- Create: `native/Bgm.StaffBiometricService/Security/MatchAssertionSigner.cs`
- Create: `native/Bgm.StaffBiometricService/Api/LoopbackMatchApi.cs`
- Create: `native/Bgm.StaffBiometricService/Program.cs`
- Create: `native/Bgm.StaffBiometricService.Tests/Security/MatchAssertionSignerTests.cs`
- Create: `components/staff/StaffGlobalBiometricBridge.tsx`
- Modify: `app/staff/layout.tsx`
- Modify: `components/staff/StaffPunchClockKiosk.tsx`
- Create: `tests/staff-global-biometric-ui-contract.test.mjs`
- Modify: `tests/staff-punch-kiosk-ui-contract.test.mjs`

**Interfaces:**
- Native service produces signed assertion payloads only; it never exposes biometric samples/templates through loopback.
- `StaffGlobalBiometricBridge` dispatches/handles staff biometric assertion events on general staff pages but suppresses punch ownership on `/staff/punch-clock`.
- `StaffPunchClockKiosk` is the only biometric punch owner on `/staff/punch-clock`.

- [ ] **Step 1: Write failing native signing and web ownership tests**

Assert short assertion TTL, unique nonce/event ID, terminal binding, no biometric fields in loopback JSON/logs; web tests assert `StaffGlobalScanner` remains mounted separately, no member modal imports in biometric bridge, and no double ownership on Punch Clock route.

- [ ] **Step 2: Run tests and verify RED**

Run: `dotnet test native/Bgm.StaffBiometricService.Tests/Bgm.StaffBiometricService.Tests.csproj && node --test tests/staff-global-biometric-ui-contract.test.mjs tests/staff-punch-kiosk-ui-contract.test.mjs`
Expected: FAIL until service/bridge implementation exists.

- [ ] **Step 3: Implement the native service using the Task 1 proven engine**

Bind the browser bridge to loopback only. Keep signing private key in Windows-protected service storage/certificate store, never in JavaScript or Supabase. Emit only signed identity assertion + non-sensitive health state.

- [ ] **Step 4: Implement browser bridge and kiosk ownership rules**

Mount `<StaffGlobalBiometricBridge />` alongside `<StaffGlobalScanner />`. On `/staff/punch-clock`, suppress the global bridge submit path and let `StaffPunchClockKiosk` own the biometric assertion event. On general staff pages, show a compact attendance result without closing/replacing member access modals.

- [ ] **Step 5: Run native + UI tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native/Bgm.StaffBiometricService native/Bgm.StaffBiometricService.Tests components/staff/StaffGlobalBiometricBridge.tsx components/staff/StaffPunchClockKiosk.tsx app/staff/layout.tsx tests/staff-global-biometric-ui-contract.test.mjs tests/staff-punch-kiosk-ui-contract.test.mjs
git commit -m "feat: bridge FP100 staff matches into portal"
```

### Task 8: Add Super Admin global enrollment, revocation and re-enrollment workflow

**Files:**
- Create: `app/api/system/staff-employees/[employeeId]/biometric/route.ts`
- Create: `app/api/system/staff-biometric/enrollment-command/route.ts`
- Modify: `components/staff/StaffEmployeeDetail.tsx`
- Modify: `components/staff/StaffEmployeesAdmin.tsx` if list status is surfaced.
- Create: `tests/staff-biometric-enrollment-api-contract.test.mjs`
- Create: `tests/staff-biometric-enrollment-ui-contract.test.mjs`

**Interfaces:**
- Enrollment command accepts selected `employeeId` and authorised enrollment terminal, expires quickly, and can create only a pending enrollment operation.
- Successful native enrollment activates one global credential; revoke marks it globally unusable; reactivation of employee does not reactivate a revoked credential.

- [ ] **Step 1: Write failing lifecycle tests**

Cover Not enrolled → pending → Enrolled globally; failed/incomplete capture does not activate; revoke blocks all terminals; re-enroll creates a new active lifecycle reference while preserving old revoked history; employee deactivate blocks matching independently.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/staff-biometric-enrollment-api-contract.test.mjs tests/staff-biometric-enrollment-ui-contract.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement Super Admin APIs**

Never return templates/ciphertext. Audit actor, employee, enrollment station, credential ID, action, timestamp and reason where applicable.

- [ ] **Step 4: Implement employee-detail controls/states**

States: `Enrolled — active globally`, `Not enrolled`, `Revoked`, `Re-enrollment required`, `Service/device unavailable`, `Enrollment failed`.

- [ ] **Step 5: Run lifecycle and employee UI regressions**

Run: `node --test tests/staff-biometric-enrollment-api-contract.test.mjs tests/staff-biometric-enrollment-ui-contract.test.mjs tests/staff-employees-ui-contract.test.mjs tests/staff-employees-api-contract.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/system/staff-employees/[employeeId]/biometric/route.ts app/api/system/staff-biometric/enrollment-command/route.ts components/staff/StaffEmployeeDetail.tsx components/staff/StaffEmployeesAdmin.tsx tests/staff-biometric-enrollment-api-contract.test.mjs tests/staff-biometric-enrollment-ui-contract.test.mjs
git commit -m "feat: manage global staff fingerprint enrollment"
```

### Task 9: TEST end-to-end verification, reporting audit and release gate

**Files:**
- Modify: Phase 3 TEST verification fixtures/scripts as applicable.
- Modify: `app/api/system/staff-attendance/timesheets/email/route.ts` only if the already-pending audit proves defects.
- Modify: relevant timesheet/report tests only for proven defects.
- Update: `docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md` with final TEST integration result, without biometric material.

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: verified TEST release candidate only; no Production migration/deploy.

- [ ] **Step 1: Run the complete attendance/fingerprint contract suite**

Run all `tests/staff-*.test.mjs` plus native service tests.
Expected: PASS.

- [ ] **Step 2: Run TEST scenario matrix**

Verify at minimum: same-gym normal day; Birkirkara IN → Marsa OUT; employee works at different gym next day without re-enrollment; FT holiday multiplier; PT holiday multiplier; historical rate change; historical employment-type change; manual fallback with reason; midnight automatic logout alert; Super Admin correction/review; missing payroll history; revoked biometric; inactive employee; inactive terminal; duplicate/replay; service/network failure with no false success.

- [ ] **Step 3: Audit timesheet email route before touching it**

Verify recipient isolation, missing-email behaviour, batch cap, audit metadata and partial-success/HTTP 207 behaviour. Change code only where a test proves a mismatch.

- [ ] **Step 4: Run build and CI-equivalent checks**

Run: `npm run build`
Run the repository Phase 2/Phase 3 CI commands used by `.github/workflows/phase2-ci.yml`.
Expected: PASS.

- [ ] **Step 5: Verify Production remains untouched and scheduler decision is still explicit**

Confirm no migration, biometric data, terminal key or environment change has been applied to `jsuolemirhivqhjbjetv`. Confirm the Production automatic-clock-out scheduler is not silently set to the Preview daily workaround.

- [ ] **Step 6: Commit final TEST verification/doc changes**

```bash
git add docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md
git add tests app/api/system/staff-attendance/timesheets/email/route.ts
git commit -m "test: verify global staff fingerprint attendance"
```

- [ ] **Step 7: Whole-branch review before any merge/Production action**

Review specifically for: biometric privacy boundary, assertion forgery/replay, global credential scoping, cross-gym session correctness, automatic-alert audit preservation, member-scanner isolation, historical payroll preservation, TEST-only database changes and scheduler readiness.

## Self-Review Result

- **Spec coverage:** global enrollment, cross-terminal capability gate, biometric privacy boundary, terminal-authoritative location, employee-global attendance, cross-gym sessions, assertion security, member separation, enrollment/revocation lifecycle, offline fail-closed behaviour, automatic logout review, manual fallback, audit, recovery, TEST-first rollout and Production scheduler gate are each assigned to a task.
- **Step scan:** each implementation task has a RED test/check, minimal implementation action, GREEN verification and commit; Task 1 and Task 9 intentionally include hardware/release gates rather than pretending they are unit-test-only work.
- **Type consistency:** `employeeId`, `biometricCredentialId`, `terminalId`, `adapterEventId`, `matchedAt`, `issuedAt`, `expiresAt`, `protocolVersion` remain the canonical assertion fields across Tasks 4–7; attendance continues through `recordStaffPunch`.
- **Review Focus:** all five risks are pinned to explicit tests in Tasks 2, 3, 4, 6 and 7.
- **Proportion:** the plan specifies decisions/interfaces/tests without transcribing implementation bodies; the capability-dependent vendor biometric method is intentionally decided by Task 1 evidence, with a mandatory stop rather than an unsafe fallback.
