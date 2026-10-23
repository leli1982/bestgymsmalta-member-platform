# FP100 Cross-Terminal Capability Evidence

Date: 2026-10-19
Updated: 2026-10-23
Status: PENDING PHYSICAL GATE
Branch: `feature/staff-attendance-payroll`

## Purpose

Prove that one BestGymsMalta staff fingerprint enrollment can be matched on a second authorised Windows computer without re-enrollment, using the same FP100 reader moved between the two computers.

This document records only non-biometric capability metadata. It must never contain raw fingerprint images, pixel buffers, biometric template bytes, encryption passphrases, or reconstructable biometric material.

## Probe mechanism

- Capture: direct FP100/CS9711 USB capture through WinUSB + `libusb-1.0.dll`.
- Sensor frame: 8,024-byte 68×118 grayscale frame held transiently in process memory only.
- Portable matching probe: SourceAFIS 3.14.0 feature template.
- Test template storage: AES-GCM encrypted credential file; PBKDF2-SHA256 passphrase derivation.
- Match threshold for this capability probe: 40.
- Raw fingerprint image/frame persistence: prohibited.
- Browser/Supabase/Vercel involvement: none.
- Production systems: untouched.

The SourceAFIS representation is being used to prove cross-machine capture/matching capability. This evidence does not by itself approve SourceAFIS as the permanent Production matcher.

## Known scanner baseline

- Reader: FP100 USB Fingerprint Reader
- Hardware ID: `USB\\VID_2541&PID_0236`
- Original Windows driver: `ChipSailing Fingerprint UsbDriver`, ChipSailing Inc, version `18.28.18.814`, `oem3.inf`
- Direct capability-test binding: WinUSB
- Direct USB runtime: 64-bit `libusb-1.0.dll`
- Vendor algorithm DLL observed: `C:\Windows\System32\CSAlgDll.dll`

## Local direct-capture preflight — 2026-10-23

Physical `direct-selftest` on the actual FP100 passed the three-scan capture/match stage:

- algorithm version: `CSAlg_C_V04.07.17S10`
- capture return codes: `1 / 1 / 1`
- sample qualities: `71 / 82 / 59`
- same-finger score: `331`
- different-finger score: `0`
- vendor template allocation: `15,600` bytes
- sensor frame: `8,024` bytes
- raw biometric material retained on disk: NO

This proves the actual reader can be captured directly through WinUSB and can distinguish a repeated finger from a different finger locally. It does **not** satisfy the cross-PC gate by itself.

## Terminal A — enrollment

Pending physical test.

Record after test:

- Computer name / environment:
- Windows version:
- WinUSB binding confirmed: YES / NO
- Probe build/commit:
- Opaque test credential ID:
- Enrollment result: PASS / FAIL
- Raw biometric material retained: NO

## Terminal B — identification without re-enrollment

Pending physical test.

Record after test:

- Computer name / environment:
- Windows version:
- WinUSB binding confirmed: YES / NO
- Same physical FP100 moved from A: YES
- Re-enrollment performed on B: NO
- Same opaque credential identified: PASS / FAIL
- Match score:

## No-match distinction

Pending physical test.

Acceptance: scanning a different finger returns `NO_MATCH`, while reader/service failures return `DEVICE_ERROR`.

Result: PASS / FAIL

## Global revocation proof

Pending physical test.

Acceptance: after revoking the opaque test credential, scanning the originally enrolled finger on Terminal B must no longer produce an accepted identity.

Result: PASS / FAIL

## Capability decision

**PENDING.** Tasks 2–9 of the global fingerprint implementation must not proceed until every physical acceptance item above passes.

If any item fails, return to architecture review. Do not replace this requirement with per-terminal or per-gym staff enrollment.
