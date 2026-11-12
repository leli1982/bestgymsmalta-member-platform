# BestGymsMalta HU20 Fingerprint Capability — TEST-only

Date: 12 November 2026

## Checkpoint

- Current production main baseline used: `6e58e7bc93c88364700b1b1443f20d60599d1a23`.
- Development branch: `feature/hu20-biometric-capability`.
- Original PR #44 is **143 ahead, 399 behind** main: do not merge, rebase, or replay en masse.
- Main already has the reader-independent payroll/admin modules, manual attendance API, timed session engine, midnight auto-close, audit, and reports.
- The old biometric prototype in PR #44 is **FP100/ChipSailing-specific**, not HU20-compatible.
- TEST Supabase `vlvyqdjhzdcxatilbdiv`: attendance tables/functions exist; read-only check returned 1 employee, 0 sessions, 0 terminals, 0 biometric credentials.
- Production Supabase `jsuolemirhivqhjbjetv`: DO NOT TOUCH.
- PR #97 voucher work was merged into main on 11 Nov; do not modify voucher flows.
- User completed HU20 on Windows 11 WebAPI demo capture: same finger matched, different fingers rejected. This proves 1:1 demo behavior on that PC, **not** native SDK integration, 1:N identification, persistence, cross-PC portability or production security.

## Goal of this phase

Prove the official SecuGen FDx SDK Pro for Windows can drive the HU20 and produce reusable templates before binding fingerprints to payroll or the internet. This branch must not alter the member app, member scanner, production API, Vercel config or database.

## Why FDx SDK Pro

- Official FDx SDK Pro for Windows supports HU20, capture, ANSI/ISO templates, C# APIs and 1:1 matching.
- For BGM's staff-only 1:N identification, locally compare one transient probe to each enrolled active fingerprint template; avoid browser exposure.
- Official WebAPI and WebAPI 1:N carry licensing/trial requirements and are **not** assumed to be a permanent free biometric service.
- WebAPI demo and WBF/Hello success do not guarantee FDx SDK success under the currently installed driver. Check the actual vendor versions/driver together.

Official references:
- https://secugen.com/products/sdk/
- https://secugen.com/request-free-software/
- https://secugen.com/drivers/
- https://secugen.com/products/webapi/

## First native SDK test

1. Request **FDx SDK Pro for Windows — FREE** from SecuGen's official download form and install the supported x64 package on the authorised Windows 11 TEST PC (do not obtain DLLs from unofficial sources).
2. Leave the currently working HU20 driver installed initially. If the native SDK reports a device or DLL error, inspect SDK-specified driver compatibility before making a driver change.
3. Open 64-bit Windows PowerShell in the folder `native/Bgm.SecuGenHu20Probe` on this branch.
4. Locate the installed `SecuGen.FDxSDKPro.Windows.dll`; its actual path depends on SDK version. Use the real path in the examples:
   ```powershell
   .\Hu20-Probe.ps1 -SdkAssembly "C:\ACTUAL\PATH\SecuGen.FDxSDKPro.Windows.dll" -Mode health
   .\Hu20-Probe.ps1 -SdkAssembly "C:\ACTUAL\PATH\SecuGen.FDxSDKPro.Windows.dll" -Mode capture
   .\Hu20-Probe.ps1 -SdkAssembly "C:\ACTUAL\PATH\SecuGen.FDxSDKPro.Windows.dll" -Mode match
   ```
5. `health` checks SDK load, device opening and image dimensions; `capture` gets one temporary vendor template; `match` captures two temporary templates and reports the vendor Normal-level comparison result. Test same and different fingers using only the authorised tester's own fingers.
6. Report only PASS/FAIL, SDK version, image dimensions, vendor numeric error codes and the SDK assembly path. **Never** transmit fingerprint images/templates/credential files.

The script intentionally stores no template, raw image, attendance event or employee record. It is **not** a service, background process, attendance endpoint or security control.

## Gates before implementing real enrollment

- Gate A: Native FDx SDK loads and captures on PC A without changing unrelated drivers. `health` + `capture` pass.
- Gate B: The native SDK's `match` rejects different fingers and matches repeated same-finger samples, with multiple attempts. This is a functional smoke test, not proof of an acceptable false-match rate.
- Gate C: Implement an isolated, locally encrypted test-credential format and perform a controlled portability test: enroll on PC A; take the same physical HU20 to PC B and match without reenrollment; later repeat with a second HU20 to establish sensor-to-sensor portability.
- Gate D: Implement and test local 1:N identification over several *voluntary* test credentials, ambiguous-match rejection, active/revoked credential handling, reader unplug/device error, retry and duplicate-event behavior. Security thresholds must be calibrated with vendor guidance and real test data.
- Gate E: Only then implement an authenticated local bridge and server-side short-lived signed assertions, terminal binding, replay protection, revocation freshness and TEST-only enrollment UI.
- Gate F: Verify end-to-end employee-global clock IN/OUT, second shift, cross-gym OUT, midnight automatic OUT, corrections, historical pay, weekly/fortnightly/monthly timesheets and all member-scanner regressions.
- Gate G: Security/privacy review and documented GDPR DPIA and employment legal basis **before employee rollout**; evaluate less intrusive attendance alternatives. No production rollout without approval.

## Security and boundaries

- Never store raw images or expose any biometric template to browser JavaScript.
- Never commit vendor binaries, SDK DLLs, credentials, test templates, passwords or employee biometric data.
- Protect enrolled templates with authenticated encryption, key management and role restrictions; encrypt transport where used.
- Enrollment is Super Admin-controlled, globally scoped to employee ID; multiple fingers may belong to the same employee, with individual revocation.
- Each accepted punch must be authorized by a registered active terminal, deriving gym from that terminal, not from the fingerprint.
- A locally matched employee ID alone is NOT proof. Signed, expiring, one-time assertions and server verification are required.
- The Punch Clock cannot fall back to member barcode, PIN or NFC. Audited Super Admin manual correction is an exception path, not a staff PIN substitute.
- No offline successful punches or silent replay.
- Preserve the existing global attendance engine and payroll snapshots.

## Test evidence currently outstanding

- [x] SecuGen HU20 connected to Windows 11 and vendor WebAPI 1:1 demo passed (user observation).
- [ ] Native FDx SDK `health`.
- [ ] Native FDx SDK `capture`.
- [ ] Native FDx SDK `match` same/different finger.
- [ ] PC A-to-PC B template portability.
- [ ] Different HU20 sensor cross-terminal recognition.
- [ ] 1:N uniqueness and false-match evaluation.
- [ ] Revocation and device unplug failure states.
- [ ] TEST-only BGM API/punch/attendance integration.
- [ ] TEST CI, native tests and end-to-end checks.
- [ ] GDPR compliance gate and explicit production approval.
