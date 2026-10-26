# BestGymsMalta FP100 Multi-Position Fingerprint Enrollment — Design Addendum

Date: 2026-10-26
Status: Approved product direction
Extends: `docs/superpowers/specs/2026-10-19-staff-fingerprint-integration-design.md`

## Purpose

Replace the single-impression experimental enrollment model with a multi-position enrollment model suited to the FP100/CS9711 small partial-image sensor.

The permanent BGM staff biometric identity remains global: enroll once for BGM, then use the same active biometric credential at any authorised BGM Punch Clock terminal.

## Chosen Enrollment Model

Version 1 enrollment captures one chosen finger five times in guided positions:

1. centre / normal placement;
2. slightly left;
3. slightly right;
4. slightly higher toward the fingertip;
5. slightly lower toward the finger base.

The UI/service must prompt the operator for each position and require the finger to be lifted between captures.

The five captures are not stitched into one raw fingerprint image. Each capture becomes its own vendor-derived biometric template. All five templates belong to one global BGM biometric credential for the employee.

A later version may add more capture stages when physical validation shows that five is insufficient, without changing the employee identity or attendance model.

## Matching Model

A normal punch remains one finger press.

The live probe is converted to a vendor template and compared against every active enrolled view for the employee/credential set. The highest valid score is the candidate score.

Acceptance threshold must not be guessed from a single experiment. It must be established by TEST hardware calibration using repeated same-finger and different-finger trials with the exact FP100 hardware, WinUSB binding, `CSAlgDll.dll` build and algorithm mode used by BGM.

The service must distinguish:

- accepted match;
- no match;
- device/capture error;
- inactive/revoked credential;
- service/configuration error.

## Enrollment Integrity

After the first capture establishes the candidate finger, later captures must be verified as belonging to the same finger before the enrollment is activated.

If a later capture does not satisfy the calibrated same-finger rule, enrollment remains incomplete and the operator is asked to repeat that stage. A failed/incomplete sequence must never create an active credential.

No raw fingerprint frame or image is persisted.

## Credential Shape

`bgm_staff_biometrics` remains the global credential record. One active row represents one employee fingerprint enrollment lifecycle.

Its encrypted biometric payload is a versioned bundle containing the five vendor-derived templates and non-sensitive view labels/order metadata. The five captures are not exposed as five unrelated employee credentials.

Conceptually:

`staff employee` -> `global biometric credential` -> `5 encrypted enrolled views`

The global credential ID, not an individual view/template, is carried into the authenticated punch assertion.

## Vendor Matching Direction

For the FP100/CS9711 path, the preferred matcher is the ChipSailing vendor template/matching engine already proven to distinguish same-finger and different-finger captures in the direct hardware self-test.

SourceAFIS remains diagnostic/prototype evidence only unless later testing proves it reliable on this small partial sensor. Production must not depend on SourceAFIS merely because it is portable.

## Mandatory Capability Gate Before Permanent Integration

Before the five-position model is wired into the real Punch Clock flow, prove on physical TEST hardware that:

1. a ChipSailing vendor template created from FP100 capture on PC A can be loaded and matched on PC B using the same supported algorithm build;
2. a same-finger scan on PC B produces a valid match;
3. a different-finger scan on PC B produces no match;
4. unplugged/unavailable reader produces a device error rather than a no-match;
5. the encrypted credential can be revoked so subsequent matching is rejected;
6. no raw fingerprint images/frames are persisted;
7. template/matcher version compatibility is checked explicitly so an unsupported DLL/algorithm build fails closed.

If vendor templates are not portable between authorised machines, stop for architecture review. Do not fall back to per-PC or per-gym staff enrollment.

## Privacy and Security

- Raw fingerprint images/frames are transient memory only.
- Stored templates remain sensitive biometric data even though they are not raw images.
- Template bundles must be encrypted at rest and in transit.
- Browser JavaScript must never receive raw frames or templates.
- Normal logs, attendance exports, payroll reports and member systems must never contain biometric material.
- Revocation removes/retires the whole active enrollment bundle globally while preserving historical attendance.

## Punch Behaviour

One successful live match identifies the global employee credential. The existing authenticated terminal remains authoritative for physical gym/location and the existing server attendance engine decides Clock In versus Clock Out.

The biometric layer does not calculate payroll, choose a gym, or maintain a gym-scoped attendance state.

## Recovery

Super Admin manual attendance remains the audited fallback for hardware/network/service failure.

A second finger may be supported later for employees who cannot obtain reliable scans, but Version 1 enrollment is one chosen finger with five guided views.