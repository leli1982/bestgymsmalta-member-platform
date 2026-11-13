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


## HU20 TEST Preview: PowerShell and Vercel Authentication (12 Nov 2026)

Vercel protects Preview deployments with Vercel Authentication. Browser login cookies do **not** automatically pass to PowerShell on a second PC. An HTML login page may have caused the earlier terminal check's "Unexpected terminal server response" even though the native sensor and terminal secret were working.

Updated `Hu20-TerminalCheck.ps1` v2 supports a **temporary deployment-scoped Share link**. For the exact TEST deployment, go to Vercel **Deployments → select the HU20 TEST Preview → Share → Anyone with the link → Copy link**. Do **not** disable Vercel Authentication or create a project-wide automation bypass secret solely for this diagnostic. Share links grant temporary access to whoever possesses them; keep them confidential and revoke after testing.

On PC 2, replace `C:\BGM-HU20\Hu20-TerminalCheck.ps1` with the latest file from this feature branch. In Windows PowerShell run (substitute your registered Terminal ID):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\BGM-HU20\Hu20-TerminalCheck.ps1" -BaseUrl "https://<exact-HU20-TEST-preview>.vercel.app" -TerminalId "<registered-terminal-uuid>"
```

When prompted, privately paste the Vercel Share link. The helper establishes a same-origin authenticated browser-equivalent cookie session *without sending the terminal secret during redirects*. Next it privately prompts for the terminal secret and issues an HTTPS request to the existing TEST-only `/api/staff-hu20/health` endpoint. It refuses non-JSON/login-page responses and any endpoint response that unexpectedly enables punching.

**The diagnostic does not upload biometrics or record attendance.** Never paste Share links, terminal secrets, `.bgmcred` files, or fingerprints into chat, GitHub or a screenshot. For actual deployments, replace preview sharing with an approved long-term secure terminal API and signed, replay-resistant scanner assertions.


### Vercel alternative alias handling (HU20 TEST helper v2.1)
The protected Vercel Share button may copy a `*.vercel.app` alias that differs from the immutable deployment URL supplied with `-BaseUrl`. The helper accepts the Share **token** from a valid HTTPS `*.vercel.app` Share URL but uses it **only** against the explicitly pinned TEST `-BaseUrl`. It never visits the pasted link's hostname and never sends the terminal secret there. A token generated for a different deployment will still fail to authenticate; in that case copy the Share link from the exact selected TEST deployment. This relaxation does **not** permit arbitrary external domains or change Vercel protection.

## HU20 Phase 2: local 1:N identification — TEST only

Use Hu20-IdentifyProbe.ps1 with the known-good HU20 x64 SDK and 1-16
locally encrypted .bgmcred throwaway credentials created with
Hu20-PortableProbe.ps1. Use your own fingers or consenting test volunteers;
do not use real employee personal data in this experiment.

PowerShell example (from C:\BGM-HU20):

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\BGM-HU20\Hu20-IdentifyProbe.ps1 -SdkAssembly C:\BGM-HU20\SecuGen.FDxSDKPro.Windows.dll -CredentialDirectory C:\BGM-HU20\test-credentials

The probe requests each credential passphrase privately, loads templates
temporarily in memory, scans once, then reports NO_MATCH, ONE_MATCH, or
AMBIGUOUS (refused). Everything is cleared best-effort after the scan.
A single credential is a basic check; two distinct encrypted credentials
are needed to exercise actual 1:N recognition.

The server-only lib/hu20BiometricVault.ts now supports TEST-locked,
AES-256-GCM authenticated template envelopes bound to employee and credential
IDs. It has deliberately NOT been wired to any enrollment API. Never configure
central biometric uploads or attendance until Super Admin authorization,
device-bound credentials, verified employee identity, a DPIA and privacy
assessment, replay prevention, and threshold calibration have been reviewed.
Production Supabase and the Member App remain untouched.

### Read-only TEST enrollment request check (PC2)

After Super Admin creates a pending request at /staff/admin/staff/terminals/enrollment
for an active employee and the registered HU20 terminal, use:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\BGM-HU20\Hu20-EnrollmentCheck.ps1" -BaseUrl "https://YOUR_TEST_DEPLOYMENT.vercel.app" -TerminalId "YOUR_TEST_TERMINAL_ID"

Paste the temporary Vercel Share token URL and private terminal secret locally.
The script fetches ONLY the authorised pending enrollment request. It does not
scan, transmit, decrypt or upload fingerprints and never records attendance.
The pending window lasts five minutes; Super Admin can cancel the request.


### Supervised central HU20 TEST enrollment
After Super Admin authorizes a five-minute enrollment from
/staff/admin/staff/terminals/enrollment, download Hu20-EnrollEmployee.ps1
to C:\BGM-HU20 on the registered HU20 Windows test terminal.

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\BGM-HU20\Hu20-EnrollEmployee.ps1" -BaseUrl "https://YOUR_TEST_DEPLOYMENT.vercel.app" -TerminalId "YOUR_TERMINAL_ID" -SdkAssembly "C:\BGM-HU20\SecuGen.FDxSDKPro.Windows.dll"

Paste the Vercel Share link and existing terminal secret only on the PC.
Confirm the named employee is present. Capture the same finger twice.
If the captures do not match, enrollment stops with no upload.
The server only accepts one single-use Super Admin authorization and stores
the ANSI378 template encrypted under a TEST Preview-only AES-256-GCM key.
Requires BGM_HU20_ENROLL_UPLOAD_ENABLED=true and BGM_HU20_TEMPLATE_KEY in
the branch-scoped encrypted Vercel Preview environment.
Attendance and payroll remain disabled; no biometric file is written locally.


## Central fingerprint recognition — TEST diagnostic

Authorise a one-shot, five-minute recognition test on the Super Admin
HU20 enrollment page. Select the registered TEST terminal.
Download Hu20-CentralRecognise.ps1 to C:\BGM-HU20 and run:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\BGM-HU20\Hu20-CentralRecognise.ps1" -BaseUrl "https://YOUR_TEST_PREVIEW.vercel.app" -TerminalId "YOUR_TERMINAL_UUID" -SdkAssembly "C:\BGM-HU20\SecuGen.FDxSDKPro.Windows.dll"

Paste the Vercel Share link and existing terminal secret privately.
No fingerprint passphrase, employee number or fingerprint file is needed.
A registered terminal can consume one TEST Super Admin authorisation,
and receives only fictitious HU20-TEST employee templates.
Templates stay in transient Windows memory; raw images stay local.
One unique match is accepted only while the centrally stored biometric
remains active. The server does not record any attendance or payroll data.
Vendor NORMAL matching is a smoke test only, not a production threshold.

## 13 November 2026 — automatic fictional HU20 TEST kiosk (not production)

The supervised one-click TEST terminal and prior one-approval-per-scan scripts remain unchanged. Automatic testing uses a separate opt-in Windows shortcut; it is not a Windows service, a real staff attendance rollout or a production deployment.

Setup on the existing HU20 Windows 11 PC, C:\BGM-HU20:

1. Keep the known-working official SecuGen DLLs. Download Hu20-AutoKiosk.ps1, Hu20-KIOSK-TEST.cmd and the updated Hu20-StartTestTerminal.ps1 from the same commit of the HU20 feature branch into the existing folder.
2. In the latest branch-scoped BGM TEST Preview Staff Portal log in as Super Admin. Open Staff → HU20 terminals. In Automatic HU20 kiosk — FICTIONAL TEST ONLY, select the existing registered Tal Qroqq terminal and select Start 10-minute TEST kiosk.
3. Double-click Hu20-KIOSK-TEST.cmd. The launcher uses its existing local non-secret TEST URL, terminal UUID and SDK path. Prompted Share URL and terminal secret must be typed privately on the Windows PC. The credentials, Share token and fingerprint templates are never written to disk.
4. The registered reader accepts a consenting fictional TEST finger automatically. Each attempt claims fresh one-time recognition evidence, verifies enrolment/revocation centrally, and records a fictional punch only on a unique match. The tester must remove their finger before another attempt.
5. At most six claim attempts are allowed in ten minutes; server throttles claims to at least 60 seconds apart. An empty sensor may consume an attempt after the recognition expires. STOP in Super Admin revokes even already-claimed, unconsumed recognition; Ctrl+C stops the local process.

Security boundaries: TEST Supabase project vlvyqdjhzdcxatilbdiv and the preview-only BGM_HU20_KIOSK_TEST_ENABLED flag for branch feature/hu20-biometric-capability. Never enable this flag in Production, never apply migration 20261113_160000 there. Staff Punch Clock on the normal Staff Portal remains disabled. NO real staff or payroll; only HU20-TEST fictional employees. SecuGen NORMAL is a smoke-test matching threshold only. Further work includes anti-spoofing, robust OS-level kiosk provisioning, fail-safe local process management, appropriate vendor threshold calibration, GDPR DPIA, employee consent/privacy assessment and explicit Production approval.


## 13 November 2026 — Full-screen fictional TEST kiosk display (Windows)

The existing native HU20 recognition, TEST attendance APIs, supervised punch test, and database rules have not changed. Automatic mode now has a separate full-screen Windows Forms status display via Hu20-KioskDisplay.ps1. It is a visual layer only; no biometric decisions or punch records are created by this screen.

**Install/update just four files** in the existing C:\BGM-HU20 folder from the same feature-branch commit:
- Hu20-KioskDisplay.ps1 (new full-screen display, in-process)
- Hu20-AutoKiosk.ps1 (TEST-only native scanner, updated status reporting)
- Hu20-StartTestTerminal.ps1 (up-to-date TEST Preview settings and GUI option)
- Hu20-KIOSK-TEST.cmd (now launches Windows PowerShell -STA in full-screen mode)

Do not reinstall the SecuGen SDK, reenroll the fictional test employee, replace the terminal secret, or change any Production application. The original Hu20-TEST.cmd supervised mode remains unchanged.

Use the latest immutable feature-branch Vercel TEST Preview; the launcher persists allowlisted non-secret settings when the selected Preview origin changes. Never save a Vercel Share token, terminal secret, or biometric data to a file. Start a short (10-minute, maximum-six-scan) TEST kiosk authorisation from the Super Admin terminals panel, then double-click Hu20-KIOSK-TEST.cmd. Type the temporary matching Preview Share link and terminal secret privately in the PowerShell window before the visual display opens.

Status messages:
- PLACE FINGER — an authorised one-time fictional TEST recognition is ready.
- REMOVE FINGER — lift the finger to prevent accidental rescan.
- VERIFYING — local identification is being confirmed by the server.
- CLOCKED IN / CLOCKED OUT — shown only after central confirmation and a successful fictional TEST attendance response.
- NOT RECOGNISED — zero or ambiguous local matches, no punch.
- PLEASE WAIT — central 60-second cooldown or scan window recovery.
- TEST ENDED / OUT OF SERVICE — no more scans, revoked window, device/network error.

Press ESC to **close the local scanner**, or use Super Admin STOP to **revoke the server-side kiosk window** (ESC alone does not revoke the server window). After a screen close, in-process display assertions prevent the native script from proceeding to a new punch; loss of network or an unexpected SDK error stops scanning. The reader is polled at most 2 seconds per SDK capture during full-screen mode so Windows can process ESC rather than remaining unresponsive through repeated 10-second blocking reads.

This is a physical TEST candidate; automated CI verifies source contracts, API isolation, application builds and regression tests, but cannot validate the actual Windows Form, screen scale, HU20 capture timing or user experience. Normal matching level remains a diagnostic smoke-test threshold; anti-spoofing, security threshold calibration, device trust, managed deployment, GDPR DPIA, worker privacy review and explicit production approval remain blocking work before any live rollout.
