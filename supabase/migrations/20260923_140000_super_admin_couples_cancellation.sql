-- Requires the staged individual cancellation migration (20260923_130000).
-- Two distinct people + one shared contract, never two independent cancellations.
-- Do not alter original expiry, imported Excel values, physical credentials, visits or payments.
create or replace function public.bgm_super_admin_couples_cancellation(
  p_system_user_id uuid,
  p_member_id uuid,
  p_partner_id uuid,
  p_membership_id uuid,
  p_expected_member_updated_at timestamptz,
  p_expected_partner_updated_at timestamptz,
  p_expected_membership_updated_at timestamptz,
  p_action text,
  p_effective_date date,
  p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_membership public.bgm_memberships%rowtype;
  v_person public.bgm_members%rowtype;
  v_updated public.bgm_members%rowtype;
  v_ids uuid[];
  v_current_matches integer;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_changed boolean := false;
  v_before jsonb;
begin
  if not exists (select 1 from public.bgm_system_users
     where id = p_system_user_id and active = true and is_super_admin = true) then
    raise exception 'Super Admin access required.';
  end if;
  if p_member_id is null or p_partner_id is null or p_member_id = p_partner_id
     or p_membership_id is null or p_expected_member_updated_at is null
     or p_expected_partner_updated_at is null or p_expected_membership_updated_at is null
     or p_action not in ('cancel', 'withdraw')
     or length(coalesce(p_reason, '')) > 500 then
    raise exception 'Invalid couples cancellation request. Reload both members.';
  end if;
  -- Lock the two identities in a fixed order, before locking the shared contract.
  -- All checks and writes are one Postgres transaction: any exception rolls back both.
  select array_agg(member_id order by member_id) into v_ids
    from public.bgm_membership_members where membership_id = p_membership_id;
  if coalesce(array_length(v_ids, 1), 0) <> 2
     or v_ids[1] = v_ids[2]
     or not (p_member_id = any(v_ids) and p_partner_id = any(v_ids)) then
    raise exception 'Couples relationship changed. Reload and review both members.';
  end if;
  perform 1 from public.bgm_members
    where id = any(v_ids) order by id for update;
  if (select count(*) from public.bgm_members where id = any(v_ids)) <> 2 then
    raise exception 'A linked member was not found.';
  end if;
  select * into v_membership from public.bgm_memberships
    where id = p_membership_id for update;
  if not found or v_membership.membership_type <> 'couples'
     or v_membership.status <> 'active'
     or v_membership.updated_at is distinct from p_expected_membership_updated_at then
    raise exception 'Shared couples membership changed. Reload both members.';
  end if;
  -- Check links again after locking the contract; concurrent link changes cannot
  -- be trusted merely because the caller supplied two UUIDs.
  if (select count(*) from public.bgm_membership_members
      where membership_id = p_membership_id) <> 2
     or not exists (select 1 from public.bgm_membership_members
      where membership_id = p_membership_id and member_id = p_member_id and member_role in ('primary','partner'))
     or not exists (select 1 from public.bgm_membership_members
      where membership_id = p_membership_id and member_id = p_partner_id and member_role in ('primary','partner')) then
    raise exception 'Couples relationship changed. Reload both members.';
  end if;
  for v_person in select * from public.bgm_members
    where id = any(v_ids) order by id
  loop
    if v_person.updated_at is distinct from
        (case when v_person.id = p_member_id then p_expected_member_updated_at
          else p_expected_partner_updated_at end) then
      raise exception 'A partner changed elsewhere. Reload both members.';
    end if;
    if v_person.status <> 'active'
       or v_person.membership_expiry is distinct from v_membership.expiry_date
       or v_membership.expiry_date < v_today then
      raise exception 'Both partners and the shared membership must be active and unexpired.';
    end if;
    if v_person.cancellation_effective_date is distinct from v_membership.cancellation_effective_date then
      raise exception 'Partners have inconsistent cancellation history. Reload both members.';
    end if;
    if v_person.cancellation_effective_date is not null
       and v_person.cancellation_effective_date <= v_today then
      raise exception 'Cancellation already took effect. Use an authorised new membership.';
    end if;
    select count(*) into v_current_matches
      from public.bgm_membership_members link
      join public.bgm_memberships m on m.id = link.membership_id
      where link.member_id = v_person.id and m.status <> 'cancelled'
        and m.expiry_date is not distinct from v_person.membership_expiry;
    if v_current_matches <> 1 then
      raise exception 'Current linked membership is ambiguous. Reload both members.';
    end if;
  end loop;
  if p_action = 'cancel' then
    if p_effective_date is null or p_effective_date < v_today
       or p_effective_date > v_membership.expiry_date then
      raise exception 'Choose an effective date from today through the shared expiry date.';
    end if;
    select exists (
      select 1 from public.bgm_members
       where id = any(v_ids)
       and (cancellation_effective_date is distinct from p_effective_date
            or cancellation_reason is distinct from v_reason)
    ) into v_changed;
    if not v_changed then
      return jsonb_build_object('changed', false,
        'effectiveDate', v_membership.cancellation_effective_date);
    end if;
  else
    if p_effective_date is not null
       or v_membership.cancellation_effective_date is null
       or v_membership.cancellation_effective_date <= v_today then
      raise exception 'Only a future joint pending cancellation can be withdrawn.';
    end if;
    v_changed := true;
  end if;
  for v_person in select * from public.bgm_members where id = any(v_ids) order by id
  loop
    v_before := jsonb_build_object(
      'memberNumber', v_person.member_number,
      'partnerId', case when v_person.id = p_member_id then p_partner_id else p_member_id end,
      'membershipId', p_membership_id,
      'effectiveDate', v_person.cancellation_effective_date,
      'reason', v_person.cancellation_reason,
      'memberStatus', v_person.status
    );
    if p_action = 'cancel' then
      update public.bgm_members set
        cancellation_effective_date = p_effective_date,
        cancellation_reason = v_reason,
        cancellation_recorded_at = clock_timestamp(),
        cancellation_recorded_by = p_system_user_id,
        status = case when p_effective_date = v_today then 'inactive' else status end,
        updated_at = clock_timestamp()
      where id = v_person.id returning * into v_updated;
    else
      update public.bgm_members set
        cancellation_effective_date = null,
        cancellation_reason = null,
        cancellation_recorded_at = null,
        cancellation_recorded_by = null,
        updated_at = clock_timestamp()
      where id = v_person.id returning * into v_updated;
    end if;
    insert into public.bgm_audit_log (
      system_user_id, context_gym_id, action_key, entity_type, entity_id,
      member_id, before_data, after_data
    ) values (
      p_system_user_id, v_person.enrollment_gym_id,
      case when p_action = 'cancel' then 'member.couples_cancellation.schedule'
        else 'member.couples_cancellation.withdraw' end,
      'member', v_person.id::text, v_person.id, v_before,
      jsonb_build_object(
        'memberNumber', v_updated.member_number,
        'partnerId', case when v_person.id = p_member_id then p_partner_id else p_member_id end,
        'membershipId', p_membership_id,
        'effectiveDate', v_updated.cancellation_effective_date,
        'reason', v_updated.cancellation_reason,
        'memberStatus', v_updated.status
      )
    );
  end loop;
  update public.bgm_memberships set
    cancellation_effective_date = case when p_action = 'cancel' then p_effective_date else null end,
    status = case when p_action = 'cancel' and p_effective_date = v_today then 'cancelled' else status end,
    updated_at = clock_timestamp()
    where id = p_membership_id;
  return jsonb_build_object('changed', true,
    'effectiveDate', case when p_action = 'cancel' then p_effective_date else null end,
    'membershipId', p_membership_id, 'membersUpdated', 2);
end;
$$;
revoke all on function public.bgm_super_admin_couples_cancellation(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,text,date,text
) from public,anon,authenticated;
grant execute on function public.bgm_super_admin_couples_cancellation(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,text,date,text
) to service_role;

-- While a future joint cancellation is pending, do not clear just one
-- partner's hold by adding them to a different contract. The renewal workflow
-- must handle the shared pending cancellation explicitly before renewal.
create or replace function public.bgm_guard_couples_pending_renewal()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.bgm_membership_members old_link
    join public.bgm_memberships old_contract on old_contract.id = old_link.membership_id
    where old_link.member_id = new.member_id
      and old_contract.id <> new.membership_id
      and old_contract.membership_type = 'couples'
      and old_contract.status = 'active'
      and old_contract.cancellation_effective_date >
        (now() at time zone 'Europe/Malta')::date
  ) then
    raise exception 'Pending couples cancellation: jointly withdraw the pending cancellation before renewal.';
  end if;
  return new;
end;
$$;
drop trigger if exists bgm_couples_pending_renewal_guard on public.bgm_membership_members;
create trigger bgm_couples_pending_renewal_guard
before insert on public.bgm_membership_members
for each row execute function public.bgm_guard_couples_pending_renewal();
