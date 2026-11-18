# HU20 nontechnical operator workflow and remaining provisioning work

Status: **TEST UX implemented; not Production approval** (18 November 2026).

## Agreed operator experience

1. Super Admin opens **Staff → Add staff**, enters identity/contact, home gym,
   employment type and hourly rate. Employment effective dates default to the
   current Malta date, editable before saving.
2. **Save staff & continue to fingerprint** creates the employee using the
   existing audited API and opens that employee's Details panel.
3. **Enrol Fingerprint** uses the registered HU20 local service on the **same
   Windows PC**; the browser never asks for a scanner ID, terminal secret,
   CLI command, one-time PIN, Share link or credential. For an eligible
   **real-staff TEST pilot** employee, an explicit confirmation requests the
   separately audited, per-person TEST authorisation before the existing
   time-limited server request and the native three-finger-placement capture.
   The server independently enforces the TEST flag, active employee, approved
   person, gym switch, registered terminal and single-use request. Errors are
   displayed without silently swallowing a failed enrollment.
4. The **Windows HU20 kiosk** (not a web page) automatically displays
   PLACE FINGER, CLOCKED IN, CLOCKED OUT, NOT RECOGNISED and error states.
   Attendance is recorded only by the existing authenticated, single-use TEST
   backend, never by screen display. Staff enter no PIN, barcode or IN/OUT code.
5. Super Admin's controlled kiosk TEST panel prefers the already provisioned
   terminal on the current PC; other terminals may still be chosen by their
   human-readable names for remote administration. Per-gym TEST enable/disable
   remains independent.

## Important distinction: installation versus routine operation

The absence of user-entered secrets in daily screens **does not** mean that
any USB fingerprint reader can safely identify itself to the server without
authentication. The existing local service exposes an already-provisioned
terminal ID over **loopback only**; that ID is an internal selector, not proof
of device identity. Server authentication, DPAPI-sealed credentials and
terminal/gym permissions remain mandatory. Detection of a configured local
service is NOT proof the physical reader is connected right now; native
capture checks the real SDK/device at scan time.

The current TEST native helper is pinned to an immutable protected Vercel
Preview origin and has an explicit one-time technician provisioning step.
As Preview commits change the hostname, the technician may have to rebind
the helper. **This is an outstanding TEST environment limitation, not an
operator task.** Do not hide it by disabling deployment protection or by
embedding Vercel Share tokens/terminal secrets in the browser or installer.

## Before a live always-on punch-clock launch

- Provide a durable, trusted **per-PC provisioning** experience for the
  installer (stable official origin; registered terminal and gym; device-bound
  credential enrollment and revocation; avoid reusable shared credentials).
  Super Admin should never handle setup tokens.
- Auto-start the locally signed Windows kiosk on a provisioned gym PC,
  with clear retry/disconnected/offline states, only after all access and
  employee gates have been reviewed. Remove temporary **10-minute TEST session**
  limits only through a separate reviewed Production design.
- Complete the outstanding clean-PC offline installation acceptance test using
  the already prechecked 50-file archive. Keep the current working PC intact.
- Complete employee biometric privacy/legal review: necessity,
  GDPR Article 6 and 9 basis, DPIA where applicable, retention and deletion,
  security, staff notices and a practical equivalent non-biometric alternative.
- Validate a real-world test matrix: cross-gym usage, second shift, midnight,
  revoke/disable, duplicate, temporary network outage, wrong reader/PC,
  and central payroll/timesheet reconciliation before opening each gym.
- Keep all TEST flags and real-pilot functions isolated from Production until
  explicit release approval.

This document records implemented UX and remaining gates. It does not
claim an authorised, always-on Production biometric attendance service.
