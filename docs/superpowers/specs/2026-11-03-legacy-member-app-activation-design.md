# Legacy Member App Activation Design

## Intent
Allow imported/legacy BestGymsMalta members who do not know their new BGM number to activate the member app without asking reception.

## Approved flow
- Keep the current BGM-number activation unchanged.
- Add a second activation route: **I only know my old membership number**.
- The member enters their legacy `pkCustomer` number and email.
- If the stored legacy member row already has that email, the same existing member row is activated.
- If the matching legacy row has no email stored, the app asks for date of birth and mobile number as additional identity checks before accepting the new email.
- After successful activation, the normal member session is created and the member sees their permanent BGM number in their account.
- Never create a duplicate `bgm_members` row.

## Identity and ambiguity rules
- `legacy_pk_customer` is not assumed unique.
- A legacy PK must resolve to exactly one member after the available identity evidence is applied.
- Stored-email path: email comparison is trimmed and case-insensitive.
- Missing-email path: require exact date of birth plus normalized phone digits matching either stored `mobile` or stored `phone`.
- If the evidence is missing, mismatched, or still ambiguous, fail without revealing another member's BGM number.
- Do not reveal the BGM number until activation has succeeded.
- Preserve the existing active-membership requirement and existing `app_enrolled` protection.

## UI
Current activation remains the default option. Add a clear secondary choice for older members who only know their old membership number. The legacy form reuses the same username/password rules. If the server says extra identity verification is required, reveal Date of Birth and Mobile Number fields and resubmit.

## Data changes
No schema migration. On the missing-email verified path only, update the existing member row's `email` together with the normal activation fields.

## Non-goals
- No staff-side workflow changes.
- No automatic membership renewal.
- No duplicate member creation or merging.
- No fuzzy PK/name matching.
- No Production database changes during development.
