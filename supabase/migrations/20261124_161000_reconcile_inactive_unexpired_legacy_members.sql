-- One-time, idempotent reconciliation of legacy members whose verified
-- membership expiry was corrected into a current period but the stored status
-- remained inactive. An effective cancellation, archive or future start must
-- never be overridden. Linked memberships require their own audited workflow.
-- No membership, card, payment, visit or member number is modified.
WITH eligible AS MATERIALIZED (
  SELECT m.id, m.member_number, m.enrollment_gym_id, m.membership_expiry,
    m.status AS old_status, m.updated_at AS old_updated_at
  FROM public.bgm_members m
  WHERE m.status = 'inactive'
    AND m.archived_at IS NULL
    AND (m.cancellation_effective_date IS NULL OR
         m.cancellation_effective_date > (now() AT TIME ZONE 'Europe/Malta')::date)
    AND m.membership_expiry >= (now() AT TIME ZONE 'Europe/Malta')::date
    AND (m.enrollment_date IS NULL OR
         m.enrollment_date <= (now() AT TIME ZONE 'Europe/Malta')::date)
    AND NOT EXISTS (
      SELECT 1 FROM public.bgm_membership_members mm WHERE mm.member_id = m.id
    )
  FOR UPDATE
),
reactivated AS (
  UPDATE public.bgm_members m SET
    status = 'active',
    updated_at = clock_timestamp()
  FROM eligible e
  WHERE m.id = e.id
    AND m.status = e.old_status
    AND m.updated_at = e.old_updated_at
    AND m.archived_at IS NULL
    AND m.membership_expiry >= (now() AT TIME ZONE 'Europe/Malta')::date
    AND (m.cancellation_effective_date IS NULL OR
         m.cancellation_effective_date > (now() AT TIME ZONE 'Europe/Malta')::date)
  RETURNING m.id, m.member_number, m.status, m.membership_expiry
)
INSERT INTO public.bgm_audit_log (
  system_user_id, context_gym_id, staff_name, action_key,
  entity_type, entity_id, member_id, before_data, after_data
)
SELECT NULL, e.enrollment_gym_id, 'System launch reconciliation',
  'member.membership_dates.status.reconcile', 'member',
  e.id::text, e.id,
  jsonb_build_object(
    'memberNumber', e.member_number, 'status', e.old_status,
    'expiryDate', e.membership_expiry, 'source', 'legacy_member'
  ),
  jsonb_build_object(
    'memberNumber', r.member_number, 'status', r.status,
    'expiryDate', r.membership_expiry, 'source', 'legacy_member',
    'autoActivated', true, 'reason', 'current corrected legacy membership expiry'
  )
FROM eligible e
JOIN reactivated r ON r.id = e.id;
