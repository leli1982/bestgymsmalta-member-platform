# BGM HU20 — TEST rollout operating runbook

Status: **TEST-only**. Verified on the same Tal-Qroqq Windows PC on 17 November 2026. **Do not infer a clean-PC installation pass, production readiness, or approval for real staff biometric processing.**

## Proven on the same PC

- SecuGen HU20 opens via FDx SDK Pro Windows v4.3.1 using four original x64 DLLs, including `sgwsqlib.dll`.
- 46-file offline installation package passes checksum verification; a same-PC automated reinstall passed.
- Restored, per-user DPAPI terminal credentials are accepted without disclosing either secret.
- Tal-Qroqq reader is detected in Super Admin; existing fictional TEST enrolments are retained.
- Fictional TEST Clock IN and Clock OUT were verified in the attendance list after reinstall.

The TEST-only installation ZIP is `BGM_HU20_INSTALL_ONLY_OFFLINE_TEST_VERIFIED.zip`, with SHA256 `07f825a75d44ef155ac1978650fa01d7b34611c88b5cd012d7abf069d0f97c0a`. This file is generated and held privately on the user's Windows PC, **not** stored in GitHub. Do not bundle terminal IDs, private credentials, DPAPI vaults or network recovery backups.

## Per-gym operational sequence

1. In TEST Super Admin, inspect **Gym rollout overview — TEST only** for gym status, per-gym feature switch, and registered PC inventory. A recent authenticated request is NOT a hardware heartbeat.
2. Keep the gym's TEST punch clock OFF while preparing the PC; do not modify Production.
3. On a *new Windows PC*, verify offline package hash and signed vendor driver, install four required x64 SDK DLLs, and perform the SecuGen reader health test.
4. In Super Admin, register a **new terminal for that specific physical PC and gym**, never reuse Tal-Qroqq's UUID or secret. Enter the one-time secret only on that PC; seal it using its current Windows user's DPAPI vault with a dedicated Vercel Automation Bypass.
5. Confirm the actual attached reader is detected on that PC; approve supervised fictional TEST fingerprint enrolment.
6. Explicitly enable that gym's TEST switch, approve a bounded TEST kiosk session, and verify fictional Clock IN, Clock OUT, session state and attendance audit.
7. Exercise disable/stop/revocation and missing-reader behaviour before opening another gym; keep the terminal private backup and registration instructions separate from the shared ZIP.

## Production-release blockers

- TEST recognition and attendance currently **accept fictional HU20-TEST employees only**. Real employee enrolment, purpose limitation, access controls, retention/deletion, a lawful biometric processing basis, and an accessible non-biometric alternative require explicit design and review.
- Validate same credentials and SDK on a *previously unconfigured* Windows machine; same-PC reinstall cannot test virgin driver installation.
- Integrate central real-staff payroll rules (multiple sessions/day, cross-gym access, timesheet correction/audit, midnight handling) and verify fail-closed behaviour under connection loss and duplicate scan attempts.
- Keep per-gym rollout OFF by default. Never merge TEST environment flags or test-only routes into live fingerprint attendance without explicit approval and regression testing.

Existing functionality: Super Admin registration/deactivation, supervised fictional enrolment, per-gym TEST switches, bounded test kiosk, and fictional attendance records. This runbook documents the sequence; it does not assert those are production-ready.
