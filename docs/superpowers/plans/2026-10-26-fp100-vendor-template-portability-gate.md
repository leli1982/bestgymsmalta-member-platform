# FP100 Vendor Template Portability Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that a ChipSailing FP100 vendor template enrolled on PC A can be securely carried to PC B and scored against a fresh live capture without persisting raw fingerprint images.

**Architecture:** Reuse the existing direct WinUSB CS9711 capture path, `ChipSailingAlgorithm`, and `EncryptedCredentialFileStore`. The probe stores one vendor template in the existing encrypted portable credential format, then PC B creates a transient live vendor template and reports the raw ChipSailing score against the stored template. No acceptance threshold is introduced in this gate; same-finger and different-finger physical results are recorded first. Full five-position enrollment is implemented only after this portability gate passes.

**Tech Stack:** .NET 8 Windows x64, libusb/WinUSB, `CSAlgDll.dll`, AES-GCM credential file, xUnit, GitHub Actions Windows probe workflow.

**Spec:** `docs/superpowers/specs/2026-10-26-staff-fingerprint-multi-position-enrollment-design.md`

## Global Constraints

- STAFF fingerprint only; member scanner path remains untouched.
- TEST/probe work only; Production Supabase remains untouched.
- No Vercel deployment is required or permitted for this native capability gate.
- Raw FP100 frames are transient memory only and must be zeroed after template extraction.
- Vendor templates remain sensitive biometric material and may only be persisted inside the encrypted credential file.
- The exact supported `CSAlgDll.dll` hash check remains fail-closed.
- No match threshold is guessed during the portability gate.
- If vendor template portability fails between PC A and PC B, stop for architecture review rather than falling back to per-PC enrollment.

## Review Focus

- Wrong or unsupported `CSAlgDll.dll` build must fail before enrollment/scoring.
- Revoked credentials must never be scored as active candidates.
- Empty/corrupt/wrong-passphrase credential files must remain explicit credential-file errors.
- Reader/USB failure must remain a device error, not a zero-score/no-match result.
- Raw frames and transient live templates must be zeroed even when template creation or scoring throws.

---

### Task 1: Vendor portable probe engine

**Files:**
- Create: `native/Bgm.StaffBiometricService/Biometric/VendorPortableBiometricProbe.cs`
- Test: `native/Bgm.StaffBiometricService.Tests/Biometric/VendorPortableBiometricProbeTests.cs`

**Interfaces:**
- Consumes: `Cs9711LibUsbCapture.CaptureFrame()`, `ChipSailingAlgorithm.CreateTemplate(byte[])`, `ChipSailingAlgorithm.MatchScore(byte[], byte[])`, `IPortableCredentialStore`.
- Produces: `VendorEnrollmentResult`, `VendorScoreResult`, `EnrollAsync(employeeId, ct)`, `ScoreAsync(ct)`.

- [ ] **Step 1: Write the failing enrollment test**

Assert that vendor enrollment saves one active `PortableBiometricCredential` whose template bytes equal the vendor template returned from the injected algorithm adapter and whose employee ID is preserved.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `dotnet test native/Bgm.StaffBiometricService.Tests/Bgm.StaffBiometricService.Tests.csproj --configuration Release --filter VendorPortableBiometricProbeTests`

Expected: FAIL because `VendorPortableBiometricProbe` does not exist.

- [ ] **Step 3: Implement vendor enrollment with injectable capture/template functions**

The production path must capture one direct CS9711 frame, create one 15,600-byte ChipSailing template, save it through `IPortableCredentialStore`, return credential/employee/algorithm metadata, and zero raw frame bytes after extraction.

- [ ] **Step 4: Write the failing live-score test**

Store one active candidate, inject a live vendor template, and assert `ScoreAsync` returns the highest raw vendor score plus candidate credential/employee IDs without converting the score into match/no-match.

Also add tests that revoked credentials are ignored and no active candidate returns an explicit no-candidate result.

- [ ] **Step 5: Implement scoring and transient-template zeroing**

Compare the live vendor template against each active stored candidate with `ChipSailingAlgorithm.MatchScore`. Return the best score and identity metadata only. Do not introduce a threshold.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run the Task 1 test filter. Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add FP100 vendor template portability probe`

### Task 2: CLI commands for physical PC A -> PC B gate

**Files:**
- Modify: `native/Bgm.StaffBiometricService/Program.cs`
- Modify: `native/Bgm.StaffBiometricService/README.md`
- Test: `native/Bgm.StaffBiometricService.Tests/Biometric/Fp100CapabilityProbeTests.cs` or a new CLI contract test file if cleaner.

**Interfaces:**
- Consumes: `VendorPortableBiometricProbe` from Task 1 and existing `EncryptedCredentialFileStore`.
- Produces CLI commands `vendor-enroll <credential-file> <employee-id>`, `vendor-score <credential-file>`, and existing `revoke <credential-file> <credential-id>` compatibility.

- [ ] **Step 1: Write failing CLI contract tests**

Require usage/help text and command routing for `vendor-enroll` and `vendor-score`. Confirm these commands do not instantiate SourceAFIS.

- [ ] **Step 2: Run tests and confirm RED**

Expected: FAIL because vendor commands are absent.

- [ ] **Step 3: Implement `vendor-enroll`**

Prompt for the existing portable credential passphrase, capture one FP100 scan through WinUSB, create a vendor template, save it encrypted, and print JSON containing operation, terminal ID, credential ID, employee ID, algorithm version, success and message.

- [ ] **Step 4: Implement `vendor-score`**

Prompt for passphrase, capture one live FP100 scan, compute the best raw vendor score against active stored vendor credentials, and print JSON containing operation, terminal ID, credential ID, employee ID, score, algorithm version and success. A missing active credential is not a fingerprint no-match; report it distinctly.

- [ ] **Step 5: Keep failure classes explicit**

Preserve `DIRECT_USB_SETUP_ERROR`, `DEVICE_ERROR`, `CREDENTIAL_FILE_ERROR` and `PROBE_ERROR` exit paths. Do not map device failure to score 0.

- [ ] **Step 6: Update README physical test instructions**

Document PC A `vendor-enroll`, secure copy of the encrypted credential file, PC B `vendor-score` with same finger, different finger, unplugged-reader test, then `revoke` and post-revocation score behavior.

- [ ] **Step 7: Run all native tests**

Run: `dotnet test native/Bgm.StaffBiometricService.Tests/Bgm.StaffBiometricService.Tests.csproj --configuration Release`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `feat: expose FP100 vendor portability commands`

### Task 3: Build and verify the Windows probe artifact

**Files:**
- No product-code change expected unless CI reveals a real defect.

**Interfaces:**
- Consumes: GitHub Actions workflow `.github/workflows/staff-biometric-probe.yml`.
- Produces: fresh self-contained `bgm-fp100-capability-probe` artifact tied to the exact branch SHA.

- [ ] **Step 1: Verify dedicated Windows probe CI is GREEN**

Confirm test, publish and artifact-upload steps all succeed for the vendor-command commit.

- [ ] **Step 2: Download and hash the artifact**

Record artifact ID, workflow run ID, branch SHA, artifact digest and inner EXE SHA256.

- [ ] **Step 3: Confirm no Vercel deployment was needed**

Do not trigger any manual deployment.

### Task 4: Physical vendor-template portability gate

**Files:**
- Modify after evidence exists: `docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md`

**Interfaces:**
- Consumes: Task 3 probe artifact and the same supported FP100/WinUSB/ChipSailing setup on both PCs.
- Produces: evidence deciding whether full five-position enrollment may proceed.

- [ ] **Step 1: PC A vendor enrollment**

Run `vendor-enroll` with a new encrypted test credential file and one chosen finger. Record terminal ID, credential ID and algorithm version. Never share the passphrase or upload the credential file.

- [ ] **Step 2: PC B same-finger score**

Copy only the encrypted credential file plus probe dependencies to PC B. Do not enroll on PC B. Run `vendor-score` with the same finger and record the raw score.

- [ ] **Step 3: PC B different-finger scores**

Run `vendor-score` with clearly different fingers and record raw scores. Do not assign an acceptance threshold yet.

- [ ] **Step 4: PC B device-error proof**

Unplug the FP100 and run `vendor-score`; verify the command returns `DEVICE_ERROR`, not score 0 or no-match.

- [ ] **Step 5: Global revocation proof**

Reconnect the reader, revoke the credential, then verify the probe refuses to score it as an active candidate.

- [ ] **Step 6: Record evidence**

Update the capability evidence document with exact commands/results and one of two outcomes:

- PASS: vendor template created on PC A is consumable/matchable on PC B with clear same/different score separation and all error/revocation checks pass; or
- FAIL: stop before five-position production integration and document the reason.

### Task 5: Gate decision for the approved five-position enrollment

**Files:**
- No code change on FAIL.
- On PASS, create a separate implementation plan for the full five-position enrollment bundle, calibration threshold, Super Admin enrollment UI, central encrypted storage and Punch Clock matching integration.

- [ ] **Step 1: Review physical evidence**

Do not infer portability from local-only tests.

- [ ] **Step 2: If PASS, plan the permanent five-position integration**

The follow-on plan must preserve one global `bgm_staff_biometrics` credential with a versioned encrypted five-template bundle and best-of-five live scoring.

- [ ] **Step 3: If FAIL, stop**

Do not silently switch back to SourceAFIS, WBF local enrollment, or per-terminal enrollment.