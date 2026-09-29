# Staff Dashboard & Reception — Implementation Plan Self-Review Amendments

> This file is part of `docs/superpowers/plans/2026-09-15-staff-dashboard-reception.md` and must be read with the main plan plus the manual-card-entry addendum.

Date: 2026-09-15
Reason: final implementation-plan self-review found one atomicity gap in pending-application corrections.

## Amendment A: Make staff correction saves atomic

Task 3 originally described updating the application row, participant row(s), then writing the audit record from the API route. Because a Couples application can touch multiple rows, those writes must not be allowed to partially succeed.

### Additional files

- Create: `supabase/migrations/<generated_timestamp>_staff_application_review_update.sql` using `supabase migration new staff_application_review_update`; do not invent the timestamp manually.
- Modify: `app/api/system/members/applications/[applicationId]/route.ts`
- Modify: `tests/staff-dashboard-api-contract.test.mjs`

### Database interface

Create a service-role-only RPC:

```sql
public.bgm_update_membership_application_review(
  p_application_id uuid,
  p_system_user_id uuid,
  p_membership_type text,
  p_duration_key text,
  p_start_date date,
  p_expiry_date date,
  p_participants jsonb
) returns jsonb
```

The function runs in one Postgres transaction and must:

1. Validate `p_system_user_id` refers to an active system user.
2. Lock the application row `FOR UPDATE`.
3. Require application status `submitted` or `awaiting_payment`.
4. Enforce gym scope inside the function: if the system user is not Super Admin, its `gym_id` must equal the application's `enrollment_gym_id`.
5. Validate membership type, duration, date order and exact participant count.
6. Validate participant IDs in `p_participants` exactly match the application's existing participant IDs; no participant insertion/deletion/reassignment is allowed through this RPC.
7. Capture full normalized `before_data` from the application and participant rows.
8. Update the application membership fields.
9. Update every participant's allowed editable fields.
10. Build full normalized `after_data`.
11. Insert `bgm_audit_log` with `action_key = 'membership.application.correct'` in the same transaction.
12. Return the corrected snapshot as JSONB.

The RPC must not accept `gym_id`, `application_kind`, participant count changes, card data, photo path changes, payment timestamps or activation state from the browser.

Revoke execution from `public`, `anon` and `authenticated`; grant only `service_role`, matching the existing activation-RPC security pattern.

### API change

`PATCH /api/system/members/applications/[applicationId]` still performs request-shape validation and permission checks, then calls only the atomic RPC for persistence. It must not independently update application/participant/audit rows.

### TDD additions

Add schema/contract assertions that the migration contains:

- `for update`
- gym ownership check against `bgm_system_users.gym_id`
- `bgm_audit_log`
- `before_data`
- `after_data`
- revokes for `public`, `anon`, `authenticated`
- grant to `service_role`

Add API contract assertion that the PATCH route calls `bgm_update_membership_application_review` and does not directly perform participant updates.

### Supabase verification

Because this is now a real schema change:

1. Apply it first only in the controlled implementation environment/branch used for this project.
2. Run the RPC against synthetic pending application data.
3. Verify a deliberately invalid participant payload leaves application, participants and audit rows unchanged.
4. Run Supabase security advisors after applying the migration.
5. Commit the generated migration file to Git.

This amendment overrides the main plan's initial expectation that no migration would be required; atomic multi-row correction is considered a genuine correctness blocker and justifies the migration.