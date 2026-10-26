# BGM FP100 Cross-PC Capability Probe

This is a TEST-only hardware capability probe. It does not connect to Supabase, Vercel, the member database, or Production.

## Safety boundary

- Run only on the authorised Windows test PCs.
- Run from an elevated Administrator PowerShell or Command Prompt.
- Raw fingerprint images / raw CS9711 frames are never written to disk.
- Vendor templates are sensitive biometric material and are stored only inside the encrypted portable credential file.
- Use a throwaway test employee label, not a real BGM employee record.
- Never upload the encrypted credential file to GitHub, Supabase, email, chat, or cloud storage.
- Delete test credentials after the capability evidence has been recorded.

## Required direct-USB setup on each PC

1. Use 64-bit Windows and install the Microsoft Visual C++ x64 runtime.
2. Back up the existing ChipSailing reader driver before changing the binding.
3. Bind only the FP100 `VID_2541&PID_0236` to **WinUSB**.
4. Keep 64-bit `libusb-1.0.dll` next to `Bgm.StaffBiometricService.exe`.
5. Keep the supported `CSAlgDll.dll` in `C:\Windows\System32`. The probe fails closed if its SHA256 does not match the tested build.

The normal WBF/ChipSailing Windows biometric path is unavailable while the reader is bound to WinUSB. That is expected for this capability test.

## Commands

```text
Bgm.StaffBiometricService.exe processed-info
Bgm.StaffBiometricService.exe direct-selftest
Bgm.StaffBiometricService.exe enroll        <credential-file> <test-employee-id>
Bgm.StaffBiometricService.exe identify      <credential-file>
Bgm.StaffBiometricService.exe vendor-enroll <credential-file> <test-employee-id>
Bgm.StaffBiometricService.exe vendor-score  <credential-file>
Bgm.StaffBiometricService.exe revoke        <credential-file> <credential-id>
```

`enroll` / `identify` are the earlier SourceAFIS diagnostic path. They are retained only for comparison.

`vendor-enroll` / `vendor-score` use the ChipSailing vendor template and matcher. `vendor-score` deliberately reports a **raw score only**; this gate does not guess an acceptance threshold.

## PC A — create a new vendor credential

Create a new test credential file; do not reuse an old SourceAFIS credential.

```powershell
New-Item -ItemType Directory -Force -Path C:\BGM-FP100
.\Bgm.StaffBiometricService.exe vendor-enroll C:\BGM-FP100\vendor-crosspc.bgmcred vendor-test-employee-1
```

Enter a temporary private passphrase. Scan one chosen finger when prompted.

Record only the printed:
- `CredentialId`
- `EmployeeId`
- `TerminalId`
- `AlgorithmVersion`

Copy the following locally/physically to PC B:
- `vendor-crosspc.bgmcred`
- `Bgm.StaffBiometricService.exe`
- `libusb-1.0.dll`

Do not send the passphrase or credential file through chat/email/cloud storage.

## PC B — same-finger vendor score without re-enrollment

Do **not** enroll on PC B.

```powershell
.\Bgm.StaffBiometricService.exe vendor-score C:\BGM-FP100\vendor-crosspc.bgmcred
```

Enter the same temporary passphrase and scan the same finger used on PC A.

Record the raw `Score`, credential ID, employee ID, terminal ID and algorithm version.

A successful command proves the PC A vendor template can be loaded and compared on PC B; it does **not** by itself establish a production match threshold.

## PC B — different-finger scores

Repeat:

```powershell
.\Bgm.StaffBiometricService.exe vendor-score C:\BGM-FP100\vendor-crosspc.bgmcred
```

using clearly different fingers. Record the raw scores. These physical same/different measurements are later used to calibrate a safe acceptance rule.

## PC B — device-error distinction

Unplug the FP100 and run `vendor-score` again.

Expected: `DEVICE_ERROR`.

A reader/capture failure must never be converted into score `0`, no-match, or a successful punch.

## Revocation

Reconnect the reader and revoke the credential using the opaque ID printed at enrollment:

```powershell
.\Bgm.StaffBiometricService.exe revoke C:\BGM-FP100\vendor-crosspc.bgmcred <CredentialId>
```

Then run `vendor-score` again.

Expected: the probe reports no active vendor credential and does not ask the reader to scan. Revocation is therefore distinct from fingerprint no-match.

## Cleanup

After recording PASS/FAIL:

- delete `vendor-crosspc.bgmcred` from both PCs and any USB drive used for transfer;
- delete obsolete SourceAFIS test credentials;
- restore the backed-up ChipSailing driver if the PC must return to WBF operation.

## Gate to the permanent BGM design

The permanent five-position enrollment is not wired into Punch Clock until the vendor portability gate proves:

1. template created on PC A can be scored on PC B;
2. same-finger and different-finger scores show usable separation;
3. unplugged reader is a device error;
4. revocation removes the active candidate globally;
5. no raw fingerprint images/frames are persisted.

If vendor templates are not portable between authorised machines, stop for architecture review. Do not fall back to per-PC or per-gym staff enrollment.
