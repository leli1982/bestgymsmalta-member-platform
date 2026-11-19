# HU20 milestone: hands-free Windows TEST kiosk startup (not Production)

**Status:** source implementation only. Windows 11 native acceptance and the separate clean-PC installer test remain outstanding. Do **not** install over the verified working C:\BGM-HU20 setup until an isolated, reversible Windows acceptance plan is agreed. No Production activation or merge is authorised by this milestone.

## Everyday behaviour

- A technician performs **one-time setup**, linking each Windows PC to its named registered terminal and gym with the existing encrypted **CurrentUser DPAPI vault**. This step still needs a privately entered terminal secret and dedicated Vercel Automation Bypass, performed **by the installer only**. Super Admin and staff never see or enter those values.
- The local enrollment bridge already starts at the configured Windows user's sign-in.
- **New opt-in:** after technician approval, `Hu20-KioskWatch.ps1` starts in the background at sign-in and makes **read-only**, terminal-authenticated checks for an active, unexpired **TEST** kiosk window.
- Without a separately approved Super Admin 10-minute window the watcher remains in standby. A disabled gym has no punch clock. No finger is captured or attendance recorded by the watcher.
- A **new** approved window opens the existing full-screen Windows HU20 kiosk. The existing kiosk independently checks all terminal, gym, employee, recognition, cooldown and attendance guards.
- Each approved window UUID is saved **before launch**, so ESC, a reboot or an uncertain punch cannot silently relaunch the **same** window. An SDK/network/authentication problem stops the watcher instead of causing repeated automatic clock-in/out attempts.
- After a normally completed window, it returns to standby awaiting a different, explicitly approved window. Staff place a finger when that supervised window is open; no codes or manual IN/OUT selection.

## Read-only Windows syntax precheck

Before enabling startup on any Windows PC, the technician can double-click `Hu20-CHECK-STARTUP-SCRIPTS-TEST.cmd`. It uses the actual Windows PowerShell 5.1 parser and does not start the kiosk, scan a fingerprint, install anything or touch credentials. The expected final line is `STARTUP SCRIPT PARSE CHECK PASS`.

## Technician-only scripts, installed after review

- `Hu20-ManageKioskStartup.ps1 -Action Status` — view whether this Windows user's TEST watcher is registered; no hardware or server operations
- `Hu20-ManageKioskStartup.ps1 -Action Enable` — verify local TEST configuration, DPAPI vault and authenticated preflight; opt in to HKCU Run on next Windows sign-in
- `Hu20-ManageKioskStartup.ps1 -Action Disable` — remove **only** this startup entry. The current watcher remains until user signs out
- Existing `Hu20-ProvisionEasyEnrollment.ps1 -EnableKioskStartup` — optional to include the above opt-in after supervised initial credential provisioning; without the flag, existing installations are unchanged

**Never** place plaintext device secrets, Vercel Share tokens or biometric templates in a startup command, local JSON config, logs, installer ZIP or chat. The startup entry contains a **script path only**. The state file holds only the terminal UUID and last-used approval-window UUID; it is not a credential.

## Remaining gates for a true gym rollout

1. **Controlled real Windows 11 test:** PowerShell 5.1 parser, SDK and actual HU20 kiosk in a *reversible isolated copy*. Verify reboot/sign-in, no active window, active window, expiry, ESC, second new window, unplug/network failure and corrupted checkpoint. No silent restart after uncertain punch.
2. **One-time installer** needs the final 50-file archive rebuilt to include these new source scripts, plus signed/hash-verified packaging and recovery. The earlier verified package is an older snapshot and does not contain this milestone.
3. **Stable service origin** independent of temporary immutable Vercel Preview deployments and durable server-side terminal provisioning/revocation. Currently the TEST app and its local config still target one immutable protected preview URL; the browser's share link is **not** a permanent API. Do not disable Vercel protection or embed bypass credentials into the browser.
4. **Production architecture:** replace 10-minute TEST windows with reviewed operational availability and explicit per-gym activation; retain server-enforced terminal and member separation, anti-replay and no-offline-punch safeguards.
5. **Biometric privacy/security:** employee notice, lawful bases including Article 9 condition, DPIA where required, encrypted biometric credential retention/revocation, and a non-biometric alternative. Approval before any real employee rollout.
6. **Hardware acceptance:** clean install on first newly equipped Windows PC, independent scanner matching, cross-gym sessions, second shift, midnight close, timesheets and payroll reconciliation.

The member app, member scanners, existing production memberships, and working Windows setup are unchanged by these repository-only TEST changes.
