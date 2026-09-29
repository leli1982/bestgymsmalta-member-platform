-- BestGymsMalta Plan 03 Task 3: explicit reception review decisions.
-- A possible renewal stays a match only until reception explicitly confirms reuse.

create or replace function public.bgm_enforce_membership_application_identity_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_classification jsonb;
  v_state text;
  v_application_kind text;
begin
  select a.application_kind
  into v_application_kind
  from public.bgm_membership_applications a
  where a.id = new.application_id;

  if v_application_kind is null then
    raise exception 'Membership application was not found.';
  end if;

  v_classification := public.bgm_classify_membership_identity(new.id_number);
  v_state := coalesce(v_classification->>'state', 'clear');

  if v_state = 'active' then
    raise exception 'An active membership already exists for this identity.';
  end if;

  new.identity_match_state := v_state;
  new.matched_member_id := nullif(v_classification->>'matchedMemberId', '')::uuid;

  if v_application_kind = 'new' then
    -- New applications may record a possible renewal match, but reception must
    -- explicitly confirm reuse through bgm_confirm_membership_existing_member.
    -- Preserve an already-confirmed reuse on later review saves only while the
    -- authoritative identity classification still points to that same member.
    if tg_op = 'INSERT'
      or new.existing_member_id is distinct from new.matched_member_id then
      new.existing_member_id := null;
    end if;
  elsif new.existing_member_id is not null
    and new.existing_member_id is distinct from new.matched_member_id then
    raise exception 'Selected renewal member no longer matches this identity.';
  end if;

  return new;
end;
$$;

revoke all on function public.bgm_enforce_membership_application_identity_match() from public, anon, authenticated;
grant execute on function public.bgm_enforce_membership_application_identity_match() to service_role;

-- Repair only reviewable New applications that were auto-linked by the previous
-- trigger. Historical/activated records are deliberately left unchanged.
update public.bgm_membership_application_members m
set existing_member_id = null,
    updated_at = now()
from public.bgm_membership_applications a
where a.id = m.application_id
  and a.application_kind = 'new'
  and a.status in ('draft', 'submitted', 'awaiting_payment')
  and m.identity_match_state = 'expired_inactive'
  and m.existing_member_id = m.matched_member_id;

create or replace function public.bgm_confirm_membership_existing_member(
  p_application_id uuid,
  p_application_member_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_participant public.bgm_membership_application_members%rowtype;
  v_system_user record;
  v_member public.bgm_members%rowtype;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_before jsonb;
  v_after jsonb;
begin
  if p_application_id is null then
    raise exception 'Membership application is required.';
  end if;
  if p_application_member_id is null then
    raise exception 'Application participant is required.';
  end if;
  if p_system_user_id is null then
    raise exception 'Reviewing system user is required.';
  end if;

  select id, gym_id, display_name, is_super_admin, active
  into v_system_user
  from public.bgm_system_users
  where id = p_system_user_id
    and active = true;

  if not found then
    raise exception 'Reviewing system user is not active.';
  end if;

  select *
  into v_application
  from public.bgm_membership_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Membership application was not found.';
  end if;
  if v_application.status not in ('submitted', 'awaiting_payment') then
    raise exception 'Membership application is no longer reviewable.';
  end if;
  if not v_system_user.is_super_admin
    and v_system_user.gym_id is distinct from v_application.enrollment_gym_id then
    raise exception 'This application belongs to another gym.';
  end if;

  select *
  into v_participant
  from public.bgm_membership_application_members
  where id = p_application_member_id
    and application_id = p_application_id
  for update;

  if not found then
    raise exception 'Application participant was not found.';
  end if;
  if v_participant.identity_match_state is distinct from 'expired_inactive'
    or v_participant.matched_member_id is null then
    raise exception 'This participant is not a possible renewal.';
  end if;

  select *
  into v_member
  from public.bgm_members
  where id = v_participant.matched_member_id
  for update;

  if not found then
    raise exception 'Matched member was not found.';
  end if;

  if lower(coalesce(v_member.status, '')) = 'active'
    and (v_member.membership_expiry is null or v_member.membership_expiry >= v_today) then
    raise exception 'Matched member is active and cannot be reused as a renewal.';
  end if;

  if v_participant.existing_member_id is not null
    and v_participant.existing_member_id is distinct from v_participant.matched_member_id then
    raise exception 'A different existing member is already selected for this participant.';
  end if;

  v_before := jsonb_build_object(
    'applicationMemberId', v_participant.id,
    'matchedMemberId', v_participant.matched_member_id,
    'existingMemberId', v_participant.existing_member_id,
    'identityMatchState', v_participant.identity_match_state
  );

  if v_participant.existing_member_id is null then
    update public.bgm_membership_application_members
    set existing_member_id = v_participant.matched_member_id,
        updated_at = now()
    where id = v_participant.id
      and application_id = p_application_id;
  end if;

  v_after := jsonb_build_object(
    'applicationMemberId', v_participant.id,
    'matchedMemberId', v_participant.matched_member_id,
    'existingMemberId', v_participant.matched_member_id,
    'identityMatchState', v_participant.identity_match_state
  );

  insert into public.bgm_audit_log(
    system_user_id,
    context_gym_id,
    staff_name,
    action_key,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    p_system_user_id,
    v_application.enrollment_gym_id,
    v_system_user.display_name,
    'membership.application.reuse_existing_member',
    'membership_application',
    p_application_id::text,
    v_before,
    v_after
  );

  return jsonb_build_object(
    'applicationId', p_application_id,
    'applicationMemberId', v_participant.id,
    'memberId', v_participant.matched_member_id,
    'memberNumber', v_member.member_number,
    'idempotent', v_participant.existing_member_id is not null
  );
end;
$$;

revoke all on function public.bgm_confirm_membership_existing_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.bgm_confirm_membership_existing_member(uuid, uuid, uuid) to service_role;

create or replace function public.bgm_reject_membership_application(
  p_application_id uuid,
  p_system_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_system_user record;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before jsonb;
  v_released_cards integer := 0;
begin
  if p_application_id is null then
    raise exception 'Membership application is required.';
  end if;
  if p_system_user_id is null then
    raise exception 'Reviewing system user is required.';
  end if;
  if v_reason is null then
    raise exception 'A rejection reason is required.';
  end if;

  select id, gym_id, display_name, is_super_admin, active
  into v_system_user
  from public.bgm_system_users
  where id = p_system_user_id
    and active = true;

  if not found then
    raise exception 'Reviewing system user is not active.';
  end if;

  select *
  into v_application
  from public.bgm_membership_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Membership application was not found.';
  end if;
  if v_application.status not in ('submitted', 'awaiting_payment') then
    raise exception 'Membership application is no longer reviewable.';
  end if;
  if not v_system_user.is_super_admin
    and v_system_user.gym_id is distinct from v_application.enrollment_gym_id then
    raise exception 'This application belongs to another gym.';
  end if;

  perform 1
  from public.bgm_membership_application_members
  where application_id = p_application_id
  for update;

  v_before := jsonb_build_object(
    'status', v_application.status,
    'cancelledAt', v_application.cancelled_at,
    'reason', v_reason
  );

  delete from public.bgm_member_card_credentials c
  where c.application_member_id in (
    select m.id
    from public.bgm_membership_application_members m
    where m.application_id = p_application_id
  )
    and c.status = 'reserved';
  get diagnostics v_released_cards = row_count;

  update public.bgm_membership_applications
  set status = 'cancelled',
      cancelled_at = now(),
      reviewed_by_system_user_id = p_system_user_id,
      updated_at = now()
  where id = p_application_id;

  insert into public.bgm_audit_log(
    system_user_id,
    context_gym_id,
    staff_name,
    action_key,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    p_system_user_id,
    v_application.enrollment_gym_id,
    v_system_user.display_name,
    'membership.application.reject',
    'membership_application',
    p_application_id::text,
    v_before,
    jsonb_build_object(
      'status', 'cancelled',
      'reason', v_reason,
      'releasedReservedCards', v_released_cards
    )
  );

  return jsonb_build_object(
    'applicationId', p_application_id,
    'status', 'cancelled',
    'reason', v_reason,
    'releasedReservedCards', v_released_cards
  );
end;
$$;

revoke all on function public.bgm_reject_membership_application(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.bgm_reject_membership_application(uuid, uuid, text) to service_role;
