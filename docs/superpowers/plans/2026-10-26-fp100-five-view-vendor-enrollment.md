# FP100 Five-View Vendor Enrollment Implementation Plan

**Date:** 26 October 2026  
**Branch:** `feature/staff-attendance-payroll`  
**Scope:** Native FP100 capability probe only. No Supabase or Vercel changes.

## Goal

Replace the one-view physical capability test with an additional five-view ChipSailing vendor-template path that covers more of the same finger while keeping punch/scoring to one live touch.

The existing `vendor-enroll` / `vendor-score` commands remain available for diagnosis. The new path is additive.

## Physical evidence driving this change

- Direct ChipSailing matching works locally on both test PCs.
- A one-view portable credential produced PC A scores `24, 0, 0` and PC B repeated scores of `0` for the same finger.
- The FP100 sensor captures a very small partial fingerprint, so a single enrolled view is too placement-sensitive for a reliable identity.
- We must not invent an acceptance threshold before collecting multi-view same-finger and different-finger data across both readers.

## Design

### Enrollment views

Capture exactly five views of one finger in this order:

1. `center` — normal centred placement
2. `left` — finger slightly left
3. `right` — finger slightly right
4. `tip` — finger slightly toward fingertip
5. `base` — finger slightly toward base

Each capture is converted independently by `CSAlgDll.dll` into a ChipSailing vendor template. Raw CS9711 frames are never persisted.

The CLI must gate each capture with an explicit prompt so the operator has time to lift and reposition the finger before capture begins.

### Credential format

Keep the existing encrypted credential envelope and top-level `PortableBiometricCredential` identity/revocation semantics.

Extend the credential with optional versioned vendor view metadata:

- bundle version
- five labelled vendor templates

Legacy credentials that only contain `Template` must still deserialize and continue to work. For the new bundle, the legacy `Template` field can retain the centre template for backward diagnostic compatibility, while the new multi-view scorer uses the labelled five-view bundle.

One employee still has one opaque credential ID and one revocation action.

### Enrollment diagnostics

For each captured view report only non-sensitive diagnostics:

- view label
- ChipSailing metric
- ChipSailing quality

After all five templates exist, report raw pairwise vendor match scores between views. These are calibration evidence only.

Do **not** reject enrollment based on a guessed same-finger score threshold yet. The current physical evidence proves legitimate same-finger placements can score zero when overlap is poor.

### Scoring

The multi-view scoring command captures one live fingerprint exactly once, creates one transient vendor template, and compares it against all enrolled views of every active credential.

Return:

- winning credential / employee
- best raw score
- best enrolled view
- raw score for every enrolled view of the winning credential
- algorithm version

No pass/fail biometric threshold is applied in this capability probe.

### Security / cleanup

- Never persist raw fingerprint frames.
- Keep the credential file AES-GCM encrypted through the existing store.
- Zero raw frame and transient template buffers where feasible.
- Do not print template bytes.
- Revocation applies to the whole credential bundle.

## CLI

Add:

- `vendor-enroll-multiview <credential-file> <test-employee-id>`
- `vendor-score-multiview <credential-file>`

Keep existing commands unchanged.

## TDD sequence

1. Add failing tests for command parsing/usage and five-view capture order.
2. Add failing tests for a versioned five-view credential bundle and legacy compatibility.
3. Add failing tests proving one live scan is compared against all five stored views and the highest score/view is returned.
4. Add failing test proving revoked credentials are ignored and no-reader behavior is preserved for an empty active set.
5. Implement the minimum model/probe/catalog changes.
6. Wire the CLI prompts and output.
7. Run the Windows biometric workflow: tests, self-contained publish, artifact upload.
8. Verify the feature branch did not create a Vercel deployment.

## Physical gate after build

1. PC A: enroll a fresh five-view credential with the guided positions.
2. PC A: collect several one-touch same-finger scores and at least one different-finger score.
3. Copy the encrypted credential plus the same probe binary/libusb to PC B.
4. PC B: collect several one-touch same-finger scores and at least one different-finger score.
5. Compare score distributions and only then choose an acceptance threshold.
6. Do not integrate with TEST attendance or Production until the cross-reader gate is demonstrated.
