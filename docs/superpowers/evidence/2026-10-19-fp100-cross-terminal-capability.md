# FP100 Cross-Terminal Capability Evidence

Date: 2026-10-19
Status: PENDING PHYSICAL GATE
Branch: `feature/staff-attendance-payroll`

## Purpose

Prove that one BestGymsMalta staff fingerprint enrollment can be matched on a second authorised Windows computer without re-enrollment, using the same FP100 reader moved between the two computers.

This document records only non-biometric capability metadata. It must never contain raw fingerprint images, pixel buffers, biometric template bytes, encryption passphrases, or reconstructable biometric material.

## Probe mechanism

- Capture: Windows Biometric Framework raw fingerprint capture through the FP100/ChipSailing Windows driver.
- Standard data: ANSI 381 uncompressed 8-bit grayscale image held transiently in process memory only.
- Portable matching probe: SourceAFIS 3.14.0 feature template.
- Test template storage: AES-GCM encrypted credential file; PBKDF2-SHA256 passphrase derivation.
- Match threshold for this capability probe: 40.
- Raw fingerprint image persistence: prohibited.
- Browser/Supabase/Vercel involvement: none.
- Production systems: untouched.

The SourceAFIS representation is being used to prove cross-machine capture/matching capability. This evidence does not by itself approve SourceAFIS as the permanent Production matcher.

## Known scanner baseline

- Reader: FP100 USB Fingerprint Reader
- Driver family: ChipSailing
- Hardware ID: `USB\\VID_2541&PID_0236`
- Windows Biometric Framework: previously verified locally

## Terminal A — enrollment

Pending physical test.

Record after test:

- Computer name / environment:
- Windows version:
- ChipSailing driver version:
- Probe build/commit:
- Opaque test credential ID:
- Enrollment result: PASS / FAIL
- Raw biometric material retained: NO

## Terminal B — identification without re-enrollment

Pending physical test.

Record after test:

- Computer name / environment:
- Windows version:
- ChipSailing driver version:
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
