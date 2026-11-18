# Real employee HU20 pilot, isolated TEST — implementation and rollout

Status: engineering pilot only; **not production-approved**. Staff privacy clearance is reported by the user, but this code does not validate the legal documentation. The application requires separate individual Super Admin activation and the isolated TEST feature flag.

## Components
- Existing HU20 TEST project is the only allowed database. `hu20TestEnabled` rejects Vercel production and any other Supabase URL.
- `BGM_HU20_REAL_STAFF_PILOT_ENABLED` defaults to off.
- Super Admin manages each real employee's pilot status from Staff → Employee → Details.
- Disabling an employee cancels pending enrolments and clears encrypted biometric templates in the same audited transaction.
- Existing 3 fictional employees and existing pilot staff share the protected TEST kiosk roster, capped at eight total. If the cap is exceeded, server rejects the request instead of silently dropping employees.
- Per-gym TEST switch must be ON for a real-staff enrollment and active kiosk, and the registered terminal determines the gym.
- Enrolment stays one-shot and requires a locally attached Windows HU20 reader, three captures, short-lived request and repeated server verification.
- Independent TEST pilot database RPCs preserve original fictional-only SQL functions. Each attendance transition uses the existing staff payroll engine, with one-use recognition and immutable punch events.

## Release checklist
1. Database: apply `hu20-real-staff-pilot-approvals.sql` then `hu20-real-staff-pilot-paths.sql` in **vlvyqdjhzdcxatilbdiv only**. Verify RLS, only service_role grants, and all four pilot RPCs.
2. Deploy to the configured HU20 TEST branch; build and tests must pass. Set `BGM_HU20_REAL_STAFF_PILOT_ENABLED=true` scoped **only** to that branch after database validation.
3. Create an actual staff test profile on TEST (zero real staff records existed on 17 Nov 2026) and set employment details, gym, hourly rate. Never import real staff data without a controlled process.
4. Super Admin authorises the selected employee individually. Use the same Windows PC and correct configured Preview origin to enrol. Verify encrypted template stored and no exposed raw template.
5. Verify kiosk Clock IN and OUT, session state and timesheet only after confirming the person is authorised and the native display truthfully marks TEST pilot operation. Maintain the 8-template limit for this pilot.
6. Confirm revocation/cancellation, repeated/replayed scans, disconnection and alternate manual attendance work without accidentally toggling attendance. Verify a disabled gym halts the terminal.
7. Future production release must include durable machine provisioning, separate production service credentials, non-biometric attendance access, template retention policies, and 1st-PC independent driver validation. Production remains untouched.

Important: the 46-file Windows installer is pinned and verified for the **original fictional TEST** native scripts. Native display/packaging must be updated and re-verified before allowing real employees to scan: the old kiosk screen says FICTIONAL TEST ONLY. Do **not** use that existing kiosk for actual employees.

Real staff pilot recognition must remain off until the native operator display and installer package are updated to mark its correct purpose and have a clean post-update check.
