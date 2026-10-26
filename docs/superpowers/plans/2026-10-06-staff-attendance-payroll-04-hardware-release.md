# Staff Attendance & Payroll Plan 04 — Fingerprint Hardware Integration & Release

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Do not invent scanner SDK behavior. Hardware-specific implementation begins only after the exact reader/terminal model and supported SDK/interface are known.

**Goal:** Connect the approved fingerprint hardware to the already-tested attendance service through the biometric adapter, complete end-to-end browser/hardware verification, harden security/privacy, and prepare a controlled TEST-to-Production rollout with explicit approval gates.

**Architecture:** The attendance/payroll domain remains hardware-independent. `StaffBiometricAdapter` is the only boundary between scanner/vendor logic and the server-authoritative punch engine. Prefer a vendor/device template reference or device-side match result. Store an encrypted biometric template only if the SDK genuinely requires server-held template material. Never store a raw fingerprint image.

**Tech Stack:** Existing Next.js/TypeScript/Supabase system plus the final scanner vendor SDK/bridge selected after hardware inspection, Node/Playwright tests, Vercel only at deliberate release-candidate checkpoints.

**Spec:** `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`

## Global Constraints

- Phase 1 core attendance/payroll can be completed and tested without hardware.
- No guessed WebUSB/WebHID/serial/vendor protocol implementation.
- Fingerprint enrolment is Super Admin only.
- A fingerprint must resolve uniquely to one active employee.
- No raw fingerprint image is persisted in Supabase, logs, audit rows, browser storage or analytics.
- Biometric templates/references must not appear in ordinary API responses.
- Browser kiosk never exposes a staff directory as a production fallback.
- Terminal identity remains independent of fingerprint identity: fingerprint determines **who**, terminal credential determines **where**.
- Hardware mismatch/failure must leave manual Super Admin fallback intact.
- Version 1 remains online-only even after hardware integration.
- Production database/deployment changes require a separate explicit user approval checkpoint.

## Task 1: Inspect the actual hardware and lock the adapter mode

**Files:**
- Create/Update: `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-hardware-addendum.md`
- No application code in this task.

**Inputs required once hardware arrives:**
- manufacturer;
- exact model;
- connection type: USB, LAN, Wi-Fi, serial, other;
- operating system on punch terminal;
- vendor SDK/runtime/library version;
- SDK licensing/runtime requirements;
- whether matching happens in device, local SDK/agent or server;
- enrolment/template export/import capabilities;
- template format/version and whether it can be safely encrypted/stored;
- supported browser integration, if any.

- [ ] **Step 1: Capture exact hardware facts**

Inspect device label/manual/vendor documentation and, where applicable, connected-device identifiers. Do not rely on appearance or a similar model number.

- [ ] **Step 2: Choose one supported integration mode**

Preference order:

1. **Device/vendor manages templates and returns stable employee/template reference** — preferred when available.
2. **Local native bridge/agent performs match and sends signed resolved identity to web app** — preferred for USB SDKs that are not browser-native.
3. **Encrypted template stored centrally and matched by supported SDK/service** — only if required and security model is acceptable.
4. Direct browser WebUSB/WebHID only if the exact hardware/vendor officially supports it reliably in the target environment.

Record why the chosen mode is appropriate and what secrets/templates exist at each boundary.

- [ ] **Step 3: Update hardware addendum and obtain user approval if the final mode materially changes the approved architecture**

No implementation starts if the SDK requires an unexpected architecture such as vendor cloud storage, raw image retention or recurring licence dependency without surfacing that to the user first.

- [ ] **Step 4: Commit hardware decision**

```bash
git add docs/superpowers/specs/2026-10-06-staff-attendance-payroll-hardware-addendum.md
git commit -m "docs: lock fingerprint hardware integration mode"
```

---

## Task 2: Implement biometric enrolment adapter with TDD

**Files:**
- Modify: `lib/staffBiometricAdapter.ts`
- Create hardware-specific file, e.g. `lib/staffBiometricAdapterVendor.ts` or local-bridge module based on Task 1
- Create: `app/api/system/staff-employees/[employeeId]/biometric/route.ts`
- Create/Modify: `tests/staff-biometric-adapter.test.mjs`
- Create: `tests/staff-biometric-enrollment-contract.test.mjs`

**Interfaces:**

```ts
export interface StaffBiometricAdapter {
  enroll(input: { employeeId: string; capturePayload: unknown }): Promise<BiometricEnrollmentResult>;
  resolveMatch(input: unknown): Promise<BiometricMatch>;
  revoke(input: { employeeId: string; biometricId: string }): Promise<void>;
}
```

- [ ] **Step 1: Write RED adapter tests**

Test only the contract and vendor behavior actually supported by the final SDK. Cover:
- successful enrolment;
- duplicate fingerprint / already assigned fingerprint;
- failed/poor-quality capture;
- unknown template/match;
- inactive/revoked biometric;
- adapter timeout/hardware unavailable;
- no raw image/template material in returned/logged API payload.

- [ ] **Step 2: Implement enrolment endpoint**

Require `requireSuperAdmin`. Validate employee exists and is active. Delegate capture/template operation to adapter. Persist only approved biometric metadata/reference/encrypted template payload.

If encrypted template material is stored centrally:
- use an application encryption key held only in environment/secrets;
- store version/algorithm metadata;
- never log plaintext template;
- plan key rotation/versioning explicitly.

Audit only metadata such as employee ID, biometric record ID, vendor, template/reference version and outcome.

- [ ] **Step 3: Enforce uniqueness**

A fingerprint/template identity cannot be active for two employee records. Treat duplicate enrolment as an explicit conflict requiring Super Admin resolution; never silently reassign.

- [ ] **Step 4: Add revoke/re-enrol behavior**

Revoke old biometric without deleting employment/attendance history. Re-enrol creates/activates the replacement identity and preserves audit history.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-biometric-adapter.test.mjs tests/staff-biometric-enrollment-contract.test.mjs
git add lib/staffBiometricAdapter.ts lib/staffBiometricAdapterVendor.ts app/api/system/staff-employees/[employeeId]/biometric/route.ts tests/staff-biometric-adapter.test.mjs tests/staff-biometric-enrollment-contract.test.mjs
git commit -m "feat: integrate staff fingerprint enrollment"
```

Use the actual hardware-specific file name rather than creating an unnecessary placeholder name.

---

## Task 3: Connect real fingerprint matching to kiosk punch flow

**Files:**
- Modify: `app/api/staff-punch-clock/punch/route.ts`
- Modify hardware adapter/bridge files from Task 2
- Modify: `components/staff/StaffPunchClockKiosk.tsx`
- Create/Modify: `tests/staff-punch-hardware-contract.test.mjs`

- [ ] **Step 1: Write RED integration tests**

Mock the vendor/local bridge at its boundary and prove:
- match resolves only an employee identity + adapter event ID;
- terminal auth supplies gym separately;
- inactive employee rejected after biometric match;
- revoked biometric rejected;
- duplicate vendor event ID does not create a second state transition;
- adapter timeout leaves attendance unchanged;
- a successful match calls the existing atomic punch state engine exactly once.

- [ ] **Step 2: Replace `hardware_not_configured` placeholder with selected adapter**

Keep feature/config detection so a terminal with unavailable driver/agent shows a clear hardware-unavailable state without breaking the rest of the app.

- [ ] **Step 3: Kiosk UX for reader states**

Support only states the real hardware exposes, e.g.:
- reader connected / waiting;
- place finger;
- reading;
- match success;
- retry / poor read;
- no match;
- reader disconnected;
- service/agent unavailable.

Do not add production staff selection or arbitrary employee ID entry.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-punch-hardware-contract.test.mjs tests/staff-punch-state-contract.test.mjs tests/staff-punch-endpoint-contract.test.mjs
git add app/api/staff-punch-clock/punch/route.ts components/staff/StaffPunchClockKiosk.tsx <hardware-adapter-files> tests/staff-punch-hardware-contract.test.mjs
git commit -m "feat: connect fingerprint reader to punch clock"
```

---

## Task 4: Complete fingerprint controls in Employee UI

**Files:**
- Modify: `components/staff/StaffEmployeeDetail.tsx`
- Modify: `components/staff/StaffEmployeesAdmin.tsx`
- Create/Modify: `tests/staff-biometric-ui-contract.test.mjs`

- [ ] **Step 1: Write RED UI contract**

Require:
- fingerprint status `Not enrolled`, `Enrolled`, `Revoked/Needs re-enrolment`;
- Super Admin-only enrol/re-enrol/revoke actions;
- hardware availability feedback;
- no display of template bytes/reference secret;
- clear confirmation before revoke/re-enrol.

- [ ] **Step 2: Implement enrolment workflow**

Use the actual SDK/bridge capture UI. Keep photo and fingerprint status separate.

- [ ] **Step 3: Implement recovery**

If enrolment fails midway, employee remains valid but fingerprint status remains not-enrolled/previous enrolled state as appropriate. Never leave a fake `Enrolled` UI flag without a valid active biometric record.

- [ ] **Step 4: Run/type/build and commit**

```bash
node --experimental-strip-types --test tests/staff-biometric-ui-contract.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build

git add components/staff/StaffEmployeeDetail.tsx components/staff/StaffEmployeesAdmin.tsx tests/staff-biometric-ui-contract.test.mjs
git commit -m "feat: add staff fingerprint enrollment ui"
```

---

## Task 5: Add full browser regression workflow

**Files:**
- Create: `tests/browser/staff-attendance-payroll.mjs`
- Modify: `.github/workflows/phase2-ci.yml`

**Interfaces:**
- Browser CI uses mocked hardware adapter/bridge; it does not require a physical reader in GitHub Actions.

- [ ] **Step 1: Build browser test fixtures**

Mock authenticated Super Admin APIs/attendance data sufficiently to verify UI behavior without weakening server contract tests.

Browser flow should cover:
- Staff tile/navigation;
- create/view Full Time employee;
- create/view Part Time employee;
- rate history;
- holiday with separate multipliers;
- terminal list/kiosk registration state;
- mocked fingerprint IN then OUT;
- cross-gym display;
- multiple sessions/day;
- Needs Attention/manual correction;
- Timesheets filters/totals;
- salary include/hide print/email controls;
- employee privacy isolation in UI actions.

- [ ] **Step 2: Add browser test to Phase 2 CI**

Run after build/server startup using the repository's existing Playwright pattern.

- [ ] **Step 3: Run locally GREEN and commit**

```bash
node tests/browser/staff-attendance-payroll.mjs

git add tests/browser/staff-attendance-payroll.mjs .github/workflows/phase2-ci.yml
git commit -m "test: add staff attendance payroll browser coverage"
```

---

## Task 6: Perform real-hardware smoke verification in TEST

**Files:**
- Update hardware addendum with test evidence/results only; no code unless a verified defect is found.

- [ ] **Step 1: Use TEST Supabase and a dedicated test employee**

Do not use Production employee/payroll records. Enrol fingerprint for a temporary test employee on a TEST terminal/gym.

- [ ] **Step 2: Verify physical scenarios**

At minimum:
- enrol finger successfully;
- unknown finger -> no punch;
- known finger -> IN;
- immediate repeated scan -> duplicate/cooldown, no OUT;
- later known finger -> OUT;
- same employee IN at Gym A / OUT at Gym B if two test terminals are available, otherwise simulate second registered TEST terminal while preserving terminal-auth path;
- disconnect reader -> hardware unavailable, no DB mutation;
- reconnect -> works again;
- inactive employee's enrolled finger -> rejected;
- revoked fingerprint -> rejected;
- re-enrolled fingerprint -> accepted.

- [ ] **Step 3: Inspect TEST database after each critical case**

Prove punch event count, open-session state, gym IDs, payroll segments and audit records match expected state.

- [ ] **Step 4: Clean temporary TEST fixtures**

Remove/void test employee/terminal/biometric data only according to the test-data cleanup procedure; never delete shared real TEST baselines inadvertently.

- [ ] **Step 5: Record evidence and commit docs if changed**

```bash
git add docs/superpowers/specs/2026-10-06-staff-attendance-payroll-hardware-addendum.md
git commit -m "docs: record fingerprint hardware verification"
```

---

## Task 7: Final self-review and release-candidate verification

**Files:**
- No mandatory new code file.
- Create an amendment only if review finds a gap: `docs/superpowers/plans/2026-10-06-staff-attendance-payroll-self-review-amendments.md`.

- [ ] **Step 1: Review implementation against every approved spec requirement**

Explicitly verify:
- employment/payroll identity is separate from system login;
- Full Time/Part Time effective history;
- rate effective history;
- two holiday multipliers + historical preservation;
- exact minute rule;
- multiple same-day sessions;
- cross-gym and cross-midnight;
- one global open session;
- manual fallback;
- immutable punch evidence;
- correction audit;
- employee-only email isolation;
- salary hide/show;
- terminal credential security;
- no raw fingerprint image;
- hardware adapter boundary.

- [ ] **Step 2: Review the five high-risk areas from the plan index**

1. concurrent/double punch;
2. Malta DST/day split;
3. historical preservation;
4. email privacy;
5. terminal gym spoof/security.

If a defect/gap is found, add a failing regression test first, fix it, then re-run all relevant checks.

- [ ] **Step 3: Run full verification**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
node tests/browser/staff-attendance-payroll.mjs
```

Also rerun existing high-value browser tests for:
- Super Admin/home;
- staff dashboard/reception;
- scanner/global access overlay;
- tablet enrollment/new membership;
- voucher/reporting if those browser tests are part of current baseline.

- [ ] **Step 4: Confirm Git working tree clean and review diff**

Use `superpowers:verification-before-completion`, then `superpowers:requesting-code-review` before claiming the feature is ready.

- [ ] **Step 5: Deliberate Preview only if needed**

The branch remains Vercel-suppressed. If a visual remote Preview is materially useful, temporarily perform the repository's controlled one-preview procedure only after checking Vercel storage/limits and with user awareness. Do not create routine previews for every commit.

---

## Task 8: Two release gates

### Gate A — Core/manual attendance system

The system may be considered for Production before fingerprint hardware integration if the user wants it, provided Plans 01–03 are fully green and the hardware-dependent kiosk/enrolment actions are clearly unavailable rather than fake.

Production rollout still requires explicit approval.

### Gate B — Fingerprint-enabled attendance system

Fingerprint punching may be enabled only after Tasks 1–7 of this plan pass with the real hardware.

- [ ] **Step 1: Present release-candidate status to user**

Report exactly what has been verified in TEST and what remains hardware-dependent/untested.

- [ ] **Step 2: Obtain explicit Production approval**

Do not apply schema, seed data, merge/deploy or enrol real employee biometrics before approval.

- [ ] **Step 3: Controlled Production migration after approval**

When approved:
1. confirm current Production deployment/main head and DB health;
2. apply the reviewed migrations to Production in order;
3. verify schema/RLS/indexes/RPCs with read-only introspection;
4. deploy/merge the approved code according to normal BGM release procedure;
5. do not automatically seed employees, wages, holidays or terminal credentials;
6. configure real employee/payroll data deliberately through Super Admin UI.

- [ ] **Step 4: Production smoke test**

Use a specifically approved test employee/terminal only if the user agrees. Verify Super Admin visibility, normal staff denial, terminal provisioning, manual fallback and (Gate B) one real fingerprint IN/OUT flow. Clean/void test attendance in an audited way rather than deleting evidence silently.

- [ ] **Step 5: Rollback posture**

If application behavior fails:
- roll back code/deployment to last known good version;
- disable affected terminals/Staff feature entry as needed;
- keep forward-compatible schema/data in place rather than dropping attendance/payroll tables and losing audit history;
- correct via forward migration after diagnosis.

Never use destructive database rollback that erases employee attendance/payroll/audit history.

## Plan 04 completion checkpoint

The feature is complete only when:
- exact scanner hardware/SDK has been documented;
- biometric enrol/match/revoke works without storing raw images;
- real-device TEST smoke tests pass;
- full automated suite/type/build/browser verification is green;
- spec-to-implementation self-review is complete;
- Production remains untouched until explicit release approval.