-- Audit action for immediate individual cancellation differs from a future schedule.
-- Replace only the existing RPC. Historical audit entries, cancellation state, and payments are unchanged.
create or replace function public.bgm_super_admin_member_cancellation(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_member_updated_at timestamptz,
  p_membership_id uuid,
  p_expected_membership_updated_at timestamptz,
  p_action text,
  p_effective_date date,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.bgm_members%rowtype;
  v_after public.bgm_members%rowtype;
  v_membership public.bgm_memberships%rowtype;
  v_membership_links integer;
  v_current_matches integer;
  v_participants integer;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_previous jsonb;
  v_changed boolean := false;
begin
  if not exists (select 1 from public.bgm_system_users
    where id = p_system_user_id and active = true and is_super_admin = true) then
    raise exception 'Super Admin access required.';
  end if;
  if p_action not in ('cancel','withdraw') or p_expected_member_updated_at is null
    or length(coalesce(p_reason,'')) > 500 then
    raise exception 'Invalid cancellation request. Reload the member.';
  end if;
  select * into v_member from public.bgm_members where id = p_member_id for update;
  if not found then raise exception 'Member not found.'; end if;
  if v_member.updated_at is distinct from p_expected_member_updated_at then
    raise exception 'Member changed elsewhere. Reload before changing cancellation.';
  end if;
  if v_member.cancellation_effective_date is not null
    and v_member.cancellation_effective_date <= v_today then
    raise exception 'Cancellation already took effect. Use a new membership renewal.';
  end if;
  if v_member.status <> 'active'
    or (v_member.membership_expiry is not null and v_member.membership_expiry < v_today) then
    raise exception 'Only currently active unexpired members can use this cancellation action.';
  end if;
  select count(*) into v_membership_links from public.bgm_membership_members
    where member_id = p_member_id;
  if v_membership_links = 0 then
    if p_membership_id is not null or p_expected_membership_updated_at is not null then
      raise exception 'The current member record changed. Reload before cancelling.';
    end if;
  else
    if p_membership_id is null or p_expected_membership_updated_at is null then
      raise exception 'A specific current linked membership is required.';
    end if;
    select * into v_membership from public.bgm_memberships
      where id = p_membership_id for update;
    if not found or v_membership.status = 'cancelled'
      or v_membership.updated_at is distinct from p_expected_membership_updated_at then
      raise exception 'Current linked membership changed. Reload before cancelling.';
    end if;
    if not exists (select 1 from public.bgm_membership_members
      where membership_id = p_membership_id and member_id = p_member_id) then
      raise exception 'This linked membership does not belong to the selected member.';
    end if;
    select count(*) into v_participants from public.bgm_membership_members
      where membership_id = p_membership_id;
    if v_participants <> 1 then
      raise exception 'Shared couples membership: use a separately approved joint action.';
    end if;
    select count(*) into v_current_matches
      from public.bgm_membership_members link
      join public.bgm_memberships membership on membership.id = link.membership_id
      where link.member_id = p_member_id
        and membership.status <> 'cancelled'
        and membership.expiry_date is not distinct from v_member.membership_expiry;
    if v_current_matches <> 1
      or v_membership.expiry_date is distinct from v_member.membership_expiry then
      raise exception 'Current linked membership is ambiguous. Reload before cancelling.';
    end if;
  end if;
  if p_action = 'cancel' then
    if p_effective_date is null or p_effective_date < v_today
      or (v_member.membership_expiry is not null
        and p_effective_date > v_member.membership_expiry) then
      raise exception 'Choose an effective date from today through the current expiry date.';
    end if;
  else
    if p_effective_date is not null or v_member.cancellation_effective_date is null
      or v_member.cancellation_effective_date <= v_today then
      raise exception 'Only a future pending cancellation can be withdrawn.';
    end if;
    if v_membership_links > 0
      and v_membership.cancellation_effective_date is distinct from v_member.cancellation_effective_date then
      raise exception 'The linked membership cancellation changed. Reload before withdrawing.';
    end if;
  end if;
  v_previous := jsonb_build_object(
    'memberNumber', v_member.member_number,
    'effectiveDate', v_member.cancellation_effective_date,
    'reason', v_member.cancellation_reason,
    'memberStatus', v_member.status,
    'membershipId', p_membership_id,
    'linkedMembershipStatus', case when v_membership_links > 0 then v_membership.status else null end
  );
  if p_action = 'cancel' then
    v_changed := v_member.cancellation_effective_date is distinct from p_effective_date
      or v_member.cancellation_reason is distinct from v_reason;
    if not v_changed then
      return jsonb_build_object('changed', false, 'effectiveDate', v_member.cancellation_effective_date);
    end if;
    update public.bgm_members set
      cancellation_effective_date = p_effective_date,
      cancellation_reason = v_reason,
      cancellation_recorded_at = clock_timestamp(),
      cancellation_recorded_by = p_system_user_id,
      status = case when p_effective_date = v_today then 'inactive' else status end,
      updated_at = clock_timestamp()
    where id = p_member_id returning * into v_after;
    if v_membership_links > 0 then
      update public.bgm_memberships set
        cancellation_effective_date = p_effective_date,
        status = case when p_effective_date = v_today then 'cancelled' else status end,
        updated_at = clock_timestamp()
      where id = p_membership_id;
    end if;
  else
    v_changed := true;
    update public.bgm_members set
      cancellation_effective_date = null,
      cancellation_reason = null,
      cancellation_recorded_at = null,
      cancellation_recorded_by = null,
      updated_at = clock_timestamp()
    where id = p_member_id returning * into v_after;
    if v_membership_links > 0 then
      update public.bgm_memberships set
        cancellation_effective_date = null,
        updated_at = clock_timestamp()
      where id = p_membership_id;
    end if;
  end if;
  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, action_key, entity_type, entity_id, member_id,
    before_data, after_data
  ) values (
    p_system_user_id, v_member.enrollment_gym_id,
    case when p_action = 'cancel' and p_effective_date = v_today then 'member.membership_cancellation.immediate'
      when p_action = 'cancel' then 'member.membership_cancellation.schedule'
      else 'member.membership_cancellation.withdraw' end,
    'member', p_member_id::text, p_member_id,
    v_previous,
    jsonb_build_object(
      'memberNumber', v_after.member_number,
      'effectiveDate', v_after.cancellation_effective_date,
      'reason', v_after.cancellation_reason,
      'memberStatus', v_after.status,
      'membershipId', p_membership_id
    )
  );
  return jsonb_build_object('changed', true,
    'effectiveDate', v_after.cancellation_effective_date,
    'updatedAt', v_after.updated_at);
end;
$$;

revoke all on function public.bgm_super_admin_member_cancellation(
  uuid,uuid,timestamptz,uuid,timestamptz,text,date,text
) from public,anon,authenticated;
grant execute on function public.bgm_super_admin_member_cancellation(
  uuid,uuid,timestamptz,uuid,timestamptz,text,date,text
) to service_role;
