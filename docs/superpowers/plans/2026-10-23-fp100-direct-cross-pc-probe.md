# FP100 Direct Cross-PC Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TEST-only FP100 cross-PC `enroll` and `identify` commands capture through the proven direct WinUSB CS9711 path while preserving the existing encrypted portable credential file and SourceAFIS matching probe.

**Architecture:** Add a small `IFingerprintCaptureSource` adapter over `Cs9711LibUsbCapture` that exposes the validated 68×118, 8-bit CS9711 frame as a 500-DPI `FingerprintSample`. Reuse the existing `PortableBiometricEngine`, `EncryptedCredentialFileStore`, `SourceAfisFingerprintMatcher(40)`, and revocation behavior. Only the native capability probe changes; Supabase, Vercel, Production, member scanning, and attendance APIs remain untouched.

**Tech Stack:** .NET 8, libusb/WinUSB, SourceAFIS 3.14.0, xUnit, existing encrypted credential store.

**Spec:** `docs/superpowers/specs/2026-10-19-staff-fingerprint-integration-design.md`

## Global Constraints

- TEST hardware/probe only; Production systems untouched.
- Raw fingerprint frames are transient in process memory only and are never written to disk.
- Browser JavaScript, Supabase, Vercel, member scanning, and attendance APIs are not involved in this capability test.
- Global enrollment remains the required behavior; do not fall back to per-terminal enrollment.
- Existing encrypted credential file and SourceAFIS threshold `40` remain the portable matching mechanism for this capability gate.

## Review Focus

- Wrong CS9711 frame size must still fail validation rather than producing a malformed SourceAFIS sample.
- All-zero frames must still fail validation.
- Cancellation must be honored before initiating a hardware capture.
- Device/libusb failures must remain distinguishable from biometric `NO_MATCH` results.
- `revoke` must continue to operate on the same encrypted credential file without requiring scanner access.

---

### Task 1: Direct WinUSB capture adapter

**Files:**
- Create: `native/Bgm.StaffBiometricService/Biometric/Cs9711DirectFingerprintCaptureSource.cs`
- Modify: `native/Bgm.StaffBiometricService.Tests/Biometric/Cs9711DirectProbeTests.cs`

**Interfaces:**
- Consumes: `Cs9711LibUsbCapture.CaptureFrame()`, `Cs9711Protocol.ImageWidth`, `Cs9711Protocol.ImageHeight`, `IFingerprintCaptureSource`.
- Produces: `Cs9711DirectFingerprintCaptureSource.CaptureAsync(CancellationToken)` returning `FingerprintSample` with 500 DPI and the validated CS9711 dimensions.

- [ ] **Step 1: Write the failing adapter test**

Add `Direct_capture_maps_cs9711_frame_to_portable_fingerprint_sample` using an injected frame function; assert terminal ID, 500 DPI, 68×118 dimensions, and exact frame bytes.

- [ ] **Step 2: Run the Windows probe test workflow and verify RED**

Expected: compile failure because `Cs9711DirectFingerprintCaptureSource` does not yet exist.

- [ ] **Step 3: Implement the minimal adapter**

Create the class with constructor `Cs9711DirectFingerprintCaptureSource(string terminalId, Func<byte[]>? captureFrame = null)` and `Task<FingerprintSample> CaptureAsync(CancellationToken ct)`. Default capture opens `Cs9711LibUsbCapture`, captures one frame, validates it, and returns it as 500-DPI 68×118 grayscale.

- [ ] **Step 4: Run the probe test suite and verify GREEN**

Expected: all native probe tests pass.

### Task 2: Route cross-PC commands through direct capture

**Files:**
- Modify: `native/Bgm.StaffBiometricService/Program.cs`
- Modify: `native/Bgm.StaffBiometricService/README.md`
- Modify: `docs/superpowers/evidence/2026-10-19-fp100-cross-terminal-capability.md`

**Interfaces:**
- Consumes: `Cs9711DirectFingerprintCaptureSource`, existing `EncryptedCredentialFileStore`, existing `SourceAfisFingerprintMatcher(40)`.
- Produces: `enroll` and `identify` commands that work while the FP100 is bound to WinUSB; `revoke` remains scanner-independent.

- [ ] **Step 1: Replace only the cross-PC capture source**

Change `Program.cs` from `WinBioFingerprintCaptureSource` to `Cs9711DirectFingerprintCaptureSource`. Keep the existing encrypted store, SourceAFIS matcher threshold 40, command names, exit-code distinctions, and credential format.

- [ ] **Step 2: Update probe instructions/evidence mechanism**

Document WinUSB + direct CS9711 capture and the required adjacent `libusb-1.0.dll`; keep the physical cross-PC gate status pending until the user completes PC A→PC B testing.

- [ ] **Step 3: Verify build/test workflow**

Expected: native probe workflow succeeds and publishes a fresh `bgm-fp100-capability-probe` artifact.
