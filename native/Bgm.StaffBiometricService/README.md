# BGM FP100 Cross-PC Capability Probe

This is a TEST-only hardware capability probe. It does not connect to Supabase, Vercel, the member database, or Production.

## Safety boundary

- Run only on the two authorised Windows test PCs.
- Run from an elevated Administrator PowerShell or Command Prompt because Windows raw biometric capture requires elevated access.
- The probe never writes raw fingerprint images to disk.
- The portable credential file contains an encrypted SourceAFIS feature template, not a raw fingerprint image.
- Use a throwaway test employee label, not a real BGM employee record.
- Delete the encrypted credential file after the capability test is recorded.

## PC A — enroll once

1. Install the ChipSailing FP100 driver and confirm the reader appears correctly in Device Manager.
2. Plug in the FP100.
3. Open PowerShell as Administrator in the folder containing `Bgm.StaffBiometricService.exe`.
4. Run:

```powershell
.\Bgm.StaffBiometricService.exe enroll C:\BGM-FP100\crosspc.bgmcred test-employee-1
```

5. Enter a temporary passphrase when prompted. Keep it available for PC B; it is not written to the credential file.
6. Scan the chosen test finger when prompted.
7. Record the opaque `CredentialId` printed by the program. Do not copy any biometric data.
8. Copy only `crosspc.bgmcred` and the probe executable to PC B.

## PC B — identify without re-enrollment

1. Install the same ChipSailing driver family and confirm Windows sees the FP100.
2. Move the same physical FP100 from PC A to PC B.
3. Do **not** enroll the finger in Windows or in the BGM probe on PC B.
4. Open PowerShell as Administrator.
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
- do not upload the credential file to GitHub, Supabase, email, chat, or cloud storage.

The permanent BestGymsMalta fingerprint architecture is not approved until all four gates pass: cross-PC match, distinct no-match, distinct device error, and revocation.
