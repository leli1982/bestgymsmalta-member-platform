-- BestGymsMalta staff attendance: atomic punch state transition and payroll snapshotting.
-- Apply to TEST first. Production rollout remains a separate approval checkpoint.

alter table public.bgm_staff_work_sessions
  drop constraint if exists bgm_staff_work_sessions_attention_code_check;

alter table public.bgm_staff_work_sessions
  add constraint bgm_staff_work_sessions_attention_code_check
  check (
    attention_code is null
    or attention_code in ('midnight_auto_clock_out', 'missing_payroll_history')
  );

create or replace function public.bgm_staff_record_punch(
  p_employee_id uuid,
  p_event_key text,
  p_source_timestamp timestamptz default now(),
  p_source text default 'terminal',
  p_terminal_id uuid default null,
  p_gym_id text default null,
  p_actor_system_user_id uuid default null,
  p_manual_reason text default null
)
returns table (
  outcome text,
  result_employee_id uuid,
  result_session_id uuid,
  result_punch_event_id uuid,
  result_effective_at timestamptz,
  result_gym_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_terminal record;
  v_open record;
  v_existing_event_id uuid;
  v_recent_event record;
  v_source text := lower(btrim(coalesce(p_source, '')));
  v_event_key text := btrim(coalesce(p_event_key, ''));
  v_actual_gym_id text;
  v_effective_at timestamptz;
  v_punch_event_id uuid;
  v_session_id uuid;
  v_terminal_id uuid;
  v_actor_id uuid;
  v_reason text;
  v_work_date date;
  v_last_work_date date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_segment_start timestamptz;
  v_segment_end timestamptz;
  v_minutes integer;
  v_rate_id uuid;
  v_rate_cents integer;
  v_employment_id uuid;
  v_employment_type text;
  v_holiday_version_id uuid;
  v_multiplier_bps integer;
  v_pay_cents integer;
  v_missing_code text;
begin
  if p_employee_id is null or v_event_key = '' or p_source_timestamp is null then
    return query
    select 'invalid_request'::text, p_employee_id, null::uuid, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  -- Serialise all punch decisions for one employee before reading open-session state.
  select e.id, e.active
  into v_employee
  from public.bgm_staff_employees e
  where e.id = p_employee_id
  for update;

  if not found or not v_employee.active then
    return query
    select 'inactive_employee'::text, p_employee_id, null::uuid, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  -- A repeated adapter/request key must never produce a second transition.
  select pe.id
  into v_existing_event_id
  from public.bgm_staff_punch_events pe
  where pe.event_key = v_event_key
  limit 1;

  if v_existing_event_id is not null then
    return query
    select 'duplicate_ignored'::text, p_employee_id, null::uuid, v_existing_event_id,
      null::timestamptz, null::text;
    return;
  end if;

  if v_source in ('terminal') then
    select t.id, t.gym_id, t.active
    into v_terminal
    from public.bgm_staff_terminals t
    where t.id = p_terminal_id;

    if not found or not v_terminal.active then
      return query
      select 'inactive_terminal'::text, p_employee_id, null::uuid, null::uuid,
        null::timestamptz, null::text;
      return;
    end if;

    -- Terminal identity is authoritative for the actual worked gym.
    v_actual_gym_id := v_terminal.gym_id;
    v_terminal_id := v_terminal.id;
    v_actor_id := null;
    v_reason := null;
  elsif v_source in ('manual') then
    v_reason := btrim(coalesce(p_manual_reason, ''));
    if p_actor_system_user_id is null or v_reason = '' or btrim(coalesce(p_gym_id, '')) = '' then
      return query
      select 'invalid_request'::text, p_employee_id, null::uuid, null::uuid,
        null::timestamptz, null::text;
      return;
    end if;

    if not exists (select 1 from public.bgm_gyms g where g.id = p_gym_id) then
      return query
      select 'invalid_request'::text, p_employee_id, null::uuid, null::uuid,
        null::timestamptz, null::text;
      return;
    end if;

    v_actual_gym_id := p_gym_id;
    v_terminal_id := null;
    v_actor_id := p_actor_system_user_id;
  else
    return query
    select 'invalid_request'::text, p_employee_id, null::uuid, null::uuid,
      null::timestamptz, null::text;
    return;
  end if;

  -- If the scheduled safeguard was delayed, enforce Malta midnight before deciding IN/OUT.
  perform public.bgm_staff_auto_close_midnight_sessions(p_source_timestamp);

  -- Ignore accidental rapid re-scans without rewriting immutable evidence.
  select pe.id, pe.source_timestamp
  into v_recent_event
  from public.bgm_staff_punch_events pe
  where pe.employee_id = p_employee_id
    and pe.source <> 'system'
  order by pe.source_timestamp desc, pe.created_at desc
  limit 1;

  if found
    and p_source_timestamp >= v_recent_event.source_timestamp
    and p_source_timestamp < v_recent_event.source_timestamp + interval '15 seconds'
  then
    return query
    select 'duplicate_ignored'::text, p_employee_id, null::uuid, v_recent_event.id,
      null::timestamptz, v_actual_gym_id;
    return;
  end if;

  v_effective_at := date_trunc('minute', p_source_timestamp);

  select s.id, s.clock_in_at, s.clock_in_gym_id, s.clock_in_terminal_id, s.status
  into v_open
  from public.bgm_staff_work_sessions s
  where s.employee_id = p_employee_id
    and s.clock_out_at is null
    and s.status <> 'void'
  order by s.clock_in_at desc
  limit 1
  for update;

  if not found then
    insert into public.bgm_staff_punch_events (
      employee_id,
      action,
      source_timestamp,
      effective_minute_timestamp,
      gym_id,
      terminal_id,
      source,
      event_key,
      actor_system_user_id,
      manual_reason,
      metadata
    )
    values (
      p_employee_id,
      'in',
      p_source_timestamp,
      v_effective_at,
      v_actual_gym_id,
      v_terminal_id,
      v_source,
      v_event_key,
      v_actor_id,
      v_reason,
      jsonb_build_object('transition', 'clocked_in')
    )
    returning id into v_punch_event_id;

    insert into public.bgm_staff_work_sessions (
      employee_id,
      clock_in_at,
      clock_in_gym_id,
      clock_in_terminal_id,
      clock_in_punch_event_id,
      status,
      created_at,
      updated_at
    )
    values (
      p_employee_id,
      v_effective_at,
      v_actual_gym_id,
      v_terminal_id,
      v_punch_event_id,
      'open',
      p_source_timestamp,
      p_source_timestamp
    )
    returning id into v_session_id;

    return query
    select 'clocked_in'::text, p_employee_id, v_session_id, v_punch_event_id,
      v_effective_at, v_actual_gym_id;
    return;
  end if;

  if v_effective_at < v_open.clock_in_at then
    return query
    select 'invalid_request'::text, p_employee_id, v_open.id, null::uuid,
      v_effective_at, v_actual_gym_id;
    return;
  end if;

  insert into public.bgm_staff_punch_events (
    employee_id,
    action,
    source_timestamp,
    effective_minute_timestamp,
    gym_id,
    terminal_id,
    source,
    event_key,
    actor_system_user_id,
    manual_reason,
    metadata
  )
  values (
    p_employee_id,
    'out',
    p_source_timestamp,
    v_effective_at,
    v_actual_gym_id,
    v_terminal_id,
    v_source,
    v_event_key,
    v_actor_id,
    v_reason,
    jsonb_build_object('transition', 'clocked_out')
  )
  returning id into v_punch_event_id;

  update public.bgm_staff_work_sessions
  set
    clock_out_at = v_effective_at,
    clock_out_gym_id = v_actual_gym_id,
    clock_out_terminal_id = v_terminal_id,
    clock_out_punch_event_id = v_punch_event_id,
    status = 'closed',
    attention_code = null,
    updated_by_system_user_id = v_actor_id,
    updated_at = p_source_timestamp
  where id = v_open.id;

  v_session_id := v_open.id;

  -- First validate every local work date so a missing history row can never create partial payroll.
  if v_effective_at > v_open.clock_in_at then
    v_work_date := (v_open.clock_in_at at time zone 'Europe/Malta')::date;
    v_last_work_date := ((v_effective_at - interval '1 microsecond') at time zone 'Europe/Malta')::date;
    v_missing_code := null;

    while v_work_date <= v_last_work_date loop
      v_rate_id := null;
      v_rate_cents := null;
      select r.id, r.hourly_rate_cents
      into v_rate_id, v_rate_cents
      from public.bgm_staff_rate_history r
      where r.employee_id = p_employee_id
        and r.effective_from <= v_work_date
      order by r.effective_from desc, r.created_at desc
      limit 1;

      if v_rate_id is null then
        v_missing_code := 'missing_rate';
        exit;
      end if;

      v_employment_id := null;
      v_employment_type := null;
      select eh.id, eh.employment_type
      into v_employment_id, v_employment_type
      from public.bgm_staff_employment_type_history eh
      where eh.employee_id = p_employee_id
        and eh.effective_from <= v_work_date
      order by eh.effective_from desc, eh.created_at desc
      limit 1;

      if v_employment_id is null then
        v_missing_code := 'missing_employment';
        exit;
      end if;

      v_work_date := v_work_date + 1;
    end loop;

    if v_missing_code is not null then
      delete from public.bgm_staff_session_payroll_segments
      where session_id = v_session_id;

      update public.bgm_staff_work_sessions
      set
        status = 'needs_attention',
        attention_code = 'missing_payroll_history',
        updated_at = p_source_timestamp
      where id = v_session_id;
    else
      v_work_date := (v_open.clock_in_at at time zone 'Europe/Malta')::date;

      while v_work_date <= v_last_work_date loop
        v_day_start := v_work_date::timestamp at time zone 'Europe/Malta';
        v_day_end := (v_work_date + 1)::timestamp at time zone 'Europe/Malta';
        v_segment_start := greatest(v_open.clock_in_at, v_day_start);
        v_segment_end := least(v_effective_at, v_day_end);
        v_minutes := (extract(epoch from (v_segment_end - v_segment_start)) / 60)::integer;

        v_rate_id := null;
        v_rate_cents := null;
        select r.id, r.hourly_rate_cents
        into v_rate_id, v_rate_cents
        from public.bgm_staff_rate_history r
        where r.employee_id = p_employee_id
          and r.effective_from <= v_work_date
        order by r.effective_from desc, r.created_at desc
        limit 1;

        v_employment_id := null;
        v_employment_type := null;
        select eh.id, eh.employment_type
        into v_employment_id, v_employment_type
        from public.bgm_staff_employment_type_history eh
        where eh.employee_id = p_employee_id
          and eh.effective_from <= v_work_date
        order by eh.effective_from desc, eh.created_at desc
        limit 1;

        v_holiday_version_id := null;
        v_multiplier_bps := null;
        select hv.id,
          case
            when v_employment_type = 'full_time' then hv.full_time_multiplier_bps
            else hv.part_time_multiplier_bps
          end
        into v_holiday_version_id, v_multiplier_bps
        from public.bgm_staff_public_holidays h
        join public.bgm_staff_public_holiday_versions hv
          on hv.holiday_id = h.id
        where h.holiday_date = v_work_date
          and hv.active = true
          and hv.superseded_at is null
        order by hv.version_no desc
        limit 1;

        if v_multiplier_bps is null then
          v_multiplier_bps := 10000;
        end if;

        v_pay_cents := round(
          (v_minutes::numeric * v_rate_cents::numeric * v_multiplier_bps::numeric)
          / (60::numeric * 10000::numeric)
        )::integer;

        insert into public.bgm_staff_session_payroll_segments (
          session_id,
          employee_id,
          work_date,
          worked_minutes,
          rate_history_id,
          hourly_rate_cents,
          employment_history_id,
          employment_type,
          holiday_version_id,
          holiday_multiplier_bps,
          pay_cents
        )
        values (
          v_session_id,
          p_employee_id,
          v_work_date,
          v_minutes,
          v_rate_id,
          v_rate_cents,
          v_employment_id,
          v_employment_type,
          v_holiday_version_id,
          v_multiplier_bps,
          v_pay_cents
        )
        on conflict (session_id, work_date) do nothing;

        v_work_date := v_work_date + 1;
      end loop;
    end if;
  end if;

  return query
  select 'clocked_out'::text, p_employee_id, v_session_id, v_punch_event_id,
    v_effective_at, v_actual_gym_id;
end;
$$;

revoke all on function public.bgm_staff_record_punch(
  uuid, text, timestamptz, text, uuid, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.bgm_staff_record_punch(
  uuid, text, timestamptz, text, uuid, text, uuid, text
) to service_role;
