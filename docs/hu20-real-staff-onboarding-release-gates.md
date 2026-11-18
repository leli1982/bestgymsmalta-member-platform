# HU20 real-staff onboarding: preparation and release gates

**Status 17 November 2026:** fictional TEST enrolment, fingerprint recognition and same-PC reinstall passed. This change adds *only* a read-only employee-profile readiness section. It does not make real employees eligible for fingerprint capture or biometric punches.

## Existing separation
- `components/staff/StaffEmployeeDetail.tsx` only exposes the quick native fingerprint enrolment control for fictional `HU20-TEST-` records.
- `app/api/system/staff-hu20/enrollments/route.ts`, `app/api/staff-hu20/enrollments/complete/route.ts`, the pending terminal route, recognition roster and TEST attendance RPC all enforce fictional-only credentials.
- Live Staff Portal's normal employment/payroll functionality remains distinct from HU20 TEST features. There must be **no global enable switch that silently disables these guards**.
- Staff attendance already uses `bgm_staff_record_punch`, with immutable events, cross-gym attribution, duplicate handling, multiple work sessions and timesheet reconciliation. TEST HU20 currently calls this through a **fictional-only, one-shot DB function**, not a general-purpose biometric production route.

## Administrative checklist on each employee record
- Employee active;
- Home gym active;
- Employment type and hourly rate recorded;
- Registered TEST terminal at home gym (hardware is not assumed online);
- Per-gym TEST switch shown but never confused with permission to capture real fingerprints.

This section is information-only. It does not store special-category data, grant permission, or let anyone change biometric state. It only renders when the TEST Super Admin terminal API is enabled.

## Before implementing or activating real biometric use
1. Obtain specialist privacy/legal review for the asserted necessity of biometric attendance and any less intrusive alternative. The Malta IDPC Employment Sector FAQ explicitly warns that employee consent is generally not freely given in employment.
2. Determine and document an Article 6 lawful basis **and** Article 9 GDPR condition (plus any applicable Maltese employment requirements); conduct a DPIA and complete any required consultation before collection.
3. Provide a fair, accessible non-biometric method to clock attendance, with equivalent treatment for staff. The existing supervised manual corrections are not necessarily an adequate everyday alternative.
4. Decide whether central storage of encrypted fingerprint templates is proportionate compared with on-card/device matching. Specify retention and deletion triggers, key rotation, data-subject rights, access/audit, security incident response.
5. Implement separate reviewed real-employee enrolment and recognition transaction paths, never expanding fictional TEST guards in place; gate each individual gym, terminal and employee separately.
6. Require real/staged acceptance: new-PC install, reader disconnect, network failure, replay/duplicate, midnight clock-out, multiple sessions/day, cross-gym Clock IN/OUT, privacy alternative, user withdrawal and revocation.
7. Only after these gates and explicit sign-off consider production rollout from a reviewed, independently tested branch.

Sources:
- Malta Information and Data Protection Commissioner Employment Sector FAQs: https://idpc.org.mt/for-organisations/employment-sector/
- Malta Information and Data Protection Commissioner DPIA guidance: https://idpc.org.mt/for-organisations/data-protection-impact-assessment/
