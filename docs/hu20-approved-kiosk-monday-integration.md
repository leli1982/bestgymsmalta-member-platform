# HU20 approved kiosk — integration and Monday verification

Status: preparation only. Browser preview is the approved visual reference; WinForms display is not yet equivalent. No production authorization.

## Confirmed data flow
- A unique local match is confirmed by /api/staff-hu20/recognition/finish before attendance is requested.
- /api/staff-hu20/attendance currently returns outcome (clocked_in, clocked_out, duplicate_ignored), employeeId, sessionId, punchEventId, gymId, and TEST/pilot flags.
- Controller passes matchedName to the display on confirmed clocked_in/clocked_out only.
- API does not currently provide authoritative event timestamp, staff number, portrait or gym display name. Do not invent these or substitute workstation time for recorded time.
- Never show success on duplicate_ignored, uncertain network result, no match or ambiguous match.

## Approved presentation contract
- Match approved preview: black #090909, charcoal #171717, yellow #FFB400, large round yellow-framed portrait, prominent green CLOCKED IN/OUT badge, employee name, optional number, trusted event time and gym.
- Optional fields need neutral fallbacks; never use fictional details in real pilot.
- Only use authenticated appropriately scoped photo retrieval. Do not persist staff portraits or attendance details locally.
- Clear transient identity/photo when returning to standby and on errors.
- Successful punches display for five seconds; preserve existing other timings.
- Do not alter biometric recognition, approval gates, revocation, duplicate handling or punch recording for UI styling.

## Monday safe integration checklist
1. Back up the exact working PC scripts locally; never upload private templates, secrets, credentials or backups.
2. SHA-256 compare installed non-secret scripts with 20 November startup and ESC recovery packages and this development branch.
3. Port design into the latest verified installed source, not the older GitHub or V4 version if different.
4. Preserve PowerShell 5.1 encoding and syntax, ESC close and scan-stop, normal-user launch and recovery, and existing security gating.
5. Verify PowerShell parse and synthetic checks; then authorised fictional fingerprint IN/OUT, duplicate, no match, uncertain response, offline, ESC and restart.
6. Only separately consider authorised pilot after acceptance. Do not merge production or change database, drivers or SDK before approval.

## Open integration dependencies
- Exact latest PC files remain unverified until Monday.
- Trusted server event time and secure employee photo/number lookup need investigation; no schema change is assumed.
- Physical Windows and HU20 testing remains outstanding.