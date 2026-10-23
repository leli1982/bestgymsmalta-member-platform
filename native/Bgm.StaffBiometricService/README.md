# BGM FP100 Cross-PC Capability Probe

This is a TEST-only hardware capability probe. It does not connect to Supabase, Vercel, the member database, or Production.

## Safety boundary

- Run only on the two authorised Windows test PCs.
- Run from an elevated Administrator PowerShell or Command Prompt.
- The probe never writes raw fingerprint images or raw CS9711 frames to disk.
- The portable credential file contains an encrypted SourceAFIS feature template, not a raw fingerprint image.
- Use a throwaway test employee label, not a real BGM employee record.
- Delete the encrypted credential file after the capability test is recorded.

## Required direct-USB setup on each test PC

The cross-PC `enroll` and `identify` commands now use the same direct CS9711/WinUSB capture path that passed the physical FP100 self-test.

1. Use 64-bit Windows and install the Microsoft Visual C++ x64 runtime if it is not already present.
2. Back up the existing ChipSailing driver before changing the reader binding.
3. Bind only the FP100 device `VID_2541&PID_0236` to **WinUSB** (for example with Zadig).
4. Keep the 64-bit `libusb-1.0.dll` in the same folder as `Bgm.StaffBiometricService.exe`.
5. `CSAlgDll.dll` in `C:\Windows\System32` is required for `direct-selftest`; the cross-PC `enroll`/`identify` path uses direct WinUSB capture plus SourceAFIS matching.

The normal Windows Biometric Framework / ChipSailing path will not operate while this reader is bound to WinUSB. That is expected for this capability test.

## PC A — enroll once

1. Confirm the FP100 is bound to WinUSB.
2. Plug in the FP100.
3. Open PowerShell as Administrator in the folder containing `Bgm.StaffBiometricService.exe` and `libusb-1.0.dll`.
4. Create the credential folder if needed:

```powershell
New-Item -ItemType Directory -Force -Path C:\BGM-FP100
```

5. Run:

```powershell
.\Bgm.StaffBiometricService.exe enroll C:\BGM-FP100\crosspc.bgmcred test-employee-1
```

6. Enter a temporary passphrase when prompted. Keep it available for PC B; it is not written to the credential file.
7. Place the chosen test finger on the FP100.
8. Record the opaque `CredentialId` printed by the program. Do not copy any biometric data.
9. Copy only these items to PC B:
   - `crosspc.bgmcred`
   - `Bgm.StaffBiometricService.exe`
   - `libusb-1.0.dll`

## PC B — identify without re-enrollment

1. Prepare PC B with the same WinUSB binding and adjacent 64-bit `libusb-1.0.dll`.
2. Move the same physical FP100 from PC A to PC B.
3. Do **not** enroll the finger in Windows or in the BGM probe on PC B.
4. Open PowerShell as Administrator in the probe folder.
5. Run:

```powershell
.\Bgm.StaffBiometricService.exe identify C:\BGM-FP100\crosspc.bgmcred
```

6. Enter the same temporary passphrase.
7. Scan the same finger used on PC A.
8. PASS requires the program to return the same opaque `CredentialId` and the test employee label.

## PC B — no-match distinction

Run `identify` again but scan a different finger.

Expected result:

```text
NO_MATCH: Fingerprint not recognised.
```

A `DEVICE_ERROR` is not a successful no-match test; it indicates reader/capture failure instead.

## PC B — revocation

Run:

```powershell
.\Bgm.StaffBiometricService.exe revoke C:\BGM-FP100\crosspc.bgmcred <CredentialId>
```

Enter the same temporary passphrase. Then run `identify` again and scan the originally enrolled finger.

Expected result after revocation:

```text
NO_MATCH: Fingerprint not recognised.
```

## Cleanup

After recording PASS/FAIL:

- delete `crosspc.bgmcred` from both PCs and any USB drive used for transfer;
- delete any copied probe package if no longer needed;
- do not upload the credential file to GitHub, Supabase, email, chat, or cloud storage;
- restore the backed-up ChipSailing driver if the machine must return to Windows Biometric Framework operation.

The permanent BestGymsMalta fingerprint architecture is not approved until all four gates pass: cross-PC match, distinct no-match, distinct device error, and revocation.
