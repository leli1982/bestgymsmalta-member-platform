-- Auto-restore Active for an eligible, uncancelled and unarchived member when
-- Super Admin corrects the verified membership dates to cover today in Malta.
-- Never override cancellations, archives or future-only memberships.
-- Super Admin-only membership date correction. Do not rewrite original Excel gym,
-- permanent BGM number, credential, historical visits, paid application, or payments.
-- A shared/ambiguous linked membership is deliberately blocked until a joint edit exists.
create or replace function public.bgm_super_admin_correct_member_dates(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_member_updated_at timestamptz,
  p_membership_id uuid,
  p_expected_membership_updated_at timestamptz,
  p_start_date date,
  p_expiry_date date
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.bgm_members%rowtype;
  v_after public.bgm_members%rowtype;
  v_membership public.bgm_memberships%rowtype;
  v_before jsonb;
  v_after_data jsonb;
  v_links integer;
  v_current_matches integer;
  v_participants integer;
  v_updated_start date;
  v_changed boolean;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_auto_activate boolean := false;
begin
  if not exists (
    select 1 from public.bgm_system_users where id = p_system_user_id
      and active = true and is_super_admin = true
  ) then
    raise exception 'Super Admin access required.';
  end if;
  if p_expiry_date is null or
     (p_start_date is not null and p_expiry_date < p_start_date) then
    raise exception 'Enter an expiry date on or after the verified start date.';
  end if;
  if p_expected_member_updated_at is null then
    raise exception 'Reload the member before correcting dates.';
  end if;

  select * into v_member from public.bgm_members
    where id = p_member_id for update;
  if not found then raise exception 'Member not found.'; end if;
  if v_member.updated_at is distinct from p_expected_member_updated_at then
    raise exception 'Member details changed elsewhere. Reload before correcting dates.';
  end if;

  -- An inactive legacy record may retain its old status when the expiry is corrected.
  -- Re-activate only for an effective current membership, never for cancelled,
  -- archived or not-yet-started records. Keep any other status untouched.
  v_auto_activate := v_member.status = 'inactive'
    and v_member.archived_at is null
    and (v_member.cancellation_effective_date is null
      or v_member.cancellation_effective_date > v_today)
    and p_expiry_date >= v_today
    and (p_start_date is null or p_start_date <= v_today);

  select count(*) into v_links
    from public.bgm_membership_members where member_id = p_member_id;

  if v_links = 0 then
    if p_membership_id is not null or p_expected_membership_updated_at is not null then
      raise exception 'This member has no linked membership to correct. Reload.';
    end if;
    -- The original legacy start date can be NULL. Never infer it from duration.
    v_before := jsonb_build_object(
      'membershipId', null, 'startDate', v_member.enrollment_date,
      'expiryDate', v_member.membership_expiry, 'source', 'legacy_member',
      'memberStatus', v_member.status
    );
    v_changed := (v_member.enrollment_date is distinct from p_start_date
      or v_member.membership_expiry is distinct from p_expiry_date
      or v_auto_activate);
    if not v_changed then
      return jsonb_build_object('changed', false, 'updatedAt', v_member.updated_at);
    end if;
    update public.bgm_members set
      enrollment_date = p_start_date,
      membership_expiry = p_expiry_date,
      status = case when v_auto_activate then 'active' else status end,
      updated_at = clock_timestamp()
    where id = p_member_id returning * into v_after;
    v_after_data := jsonb_build_object(
      'membershipId', null, 'startDate', v_after.enrollment_date,
      'expiryDate', v_after.membership_expiry, 'source', 'legacy_member',
      'memberStatus', v_after.status, 'autoActivated', v_auto_activate
    );
  else
    if p_membership_id is null or p_expected_membership_updated_at is null
      or p_start_date is null then
      raise exception 'A specific current membership and verified start date are required.';
    end if;
    select * into v_membership from public.bgm_memberships
      where id = p_membership_id for update;
    if not found or v_membership.status = 'cancelled' then
      raise exception 'Current linked membership was not found or has been cancelled.';
    end if;
    if v_membership.updated_at is distinct from p_expected_membership_updated_at then
      raise exception 'Membership changed elsewhere. Reload before correcting dates.';
    end if;
    if not exists (
      select 1 from public.bgm_membership_members
      where membership_id = p_membership_id and member_id = p_member_id
    ) then
      raise exception 'This membership does not belong to this member.';
    end if;
    select count(*) into v_participants from public.bgm_membership_members
      where membership_id = p_membership_id;
    if v_participants <> 1 then
      raise exception 'Shared membership: change both members together using the joint correction action.';
    end if;
    -- A linked membership must itself be active before restoring member access.
    v_auto_activate := v_auto_activate and v_membership.status = 'active';
    select count(*) into v_current_matches
      from public.bgm_membership_members link
      join public.bgm_memberships membership on membership.id = link.membership_id
      where link.member_id = p_member_id and membership.status <> 'cancelled'
        and membership.expiry_date is not distinct from v_member.membership_expiry;
    if v_current_matches <> 1
      or v_membership.expiry_date is distinct from v_member.membership_expiry then
      raise exception 'Current membership is ambiguous or changed. Reload and review the member.';
    end if;

    v_before := jsonb_build_object(
      'membershipId', v_membership.id, 'startDate', v_membership.start_date,
      'expiryDate', v_membership.expiry_date,
      'memberEnrollmentDate', v_member.enrollment_date,
      'memberExpiryDate', v_member.membership_expiry,
      'membershipStatus', v_membership.status,
      'memberStatus', v_member.status
    );
    -- Preserve an unrelated historical enrollment date. When the member-level
    -- date matches the current canonical record, adjust it alongside that record.
    v_updated_start := case
      when v_member.enrollment_date is not distinct from v_membership.start_date
      then p_start_date else v_member.enrollment_date end;
    v_changed := (v_membership.start_date is distinct from p_start_date
      or v_membership.expiry_date is distinct from p_expiry_date
      or v_member.membership_expiry is distinct from p_expiry_date
      or v_auto_activate);
    if not v_changed then
      return jsonb_build_object('changed', false, 'updatedAt', v_member.updated_at);
    end if;
    update public.bgm_memberships set
      start_date = p_start_date,
      expiry_date = p_expiry_date,
      updated_at = clock_timestamp()
    where id = p_membership_id;
    update public.bgm_members set
      enrollment_date = v_updated_start,
      membership_expiry = p_expiry_date,
      status = case when v_auto_activate then 'active' else status end,
      updated_at = clock_timestamp()
    where id = p_member_id returning * into v_after;
    v_after_data := jsonb_build_object(
      'membershipId', v_membership.id, 'startDate', p_start_date,
      'expiryDate', p_expiry_date,
      'memberEnrollmentDate', v_after.enrollment_date,
      'memberExpiryDate', v_after.membership_expiry,
      'membershipStatus', v_membership.status,
      'memberStatus', v_after.status, 'autoActivated', v_auto_activate
    );
  end if;

  -- A failed audit insert rolls back BOTH the linked membership and member edits.
  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, action_key, entity_type,
    entity_id, member_id, before_data, after_data
  ) values (
    p_system_user_id, v_member.enrollment_gym_id,
    'member.membership_dates.correct', 'member',
    p_member_id::text, p_member_id, v_before, v_after_data
  );
  return jsonb_build_object('changed', true, 'updatedAt', v_after.updated_at);
end;
$$;

revoke all on function public.bgm_super_admin_correct_member_dates(
  uuid, uuid, timestamptz, uuid, timestamptz, date, date
) from public, anon, authenticated;
grant execute on function public.bgm_super_admin_correct_member_dates(
  uuid, uuid, timestamptz, uuid, timestamptz, date, date
) to service_role;
