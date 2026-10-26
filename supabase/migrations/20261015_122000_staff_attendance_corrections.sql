-- BestGymsMalta staff attendance corrections, review workflow and shared payroll rebuild.
-- Apply to TEST first. Production rollout remains a separate approval checkpoint.

create or replace function public.bgm_staff_rebuild_session_payroll(
  p_session_id uuid,
  p_calculated_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
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
begin
  select s.*
  into v_session
  from public.bgm_staff_work_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'Staff attendance session not found.';
  end if;

  delete from public.bgm_staff_session_payroll_segments
  where session_id = p_session_id;

  if v_session.clock_out_at is null then
    return 'open';
  end if;

  if v_session.clock_out_at < v_session.clock_in_at then
    raise exception 'Clock-out cannot be before clock-in.';
  end if;

  if v_session.clock_out_at = v_session.clock_in_at then
    return 'complete';
  end if;

  v_work_date := (v_session.clock_in_at at time zone 'Europe/Malta')::date;
  v_last_work_date := ((v_session.clock_out_at - interval '1 microsecond') at time zone 'Europe/Malta')::date;

  -- Validate all required histories before writing any segment so a failed rebuild is never partial.
  while v_work_date <= v_last_work_date loop
    select r.id, r.hourly_rate_cents
    into v_rate_id, v_rate_cents
    from public.bgm_staff_rate_history r
    where r.employee_id = v_session.employee_id
      and r.effective_from <= v_work_date
    order by r.effective_from desc, r.created_at desc
    limit 1;

    if v_rate_id is null then
      return 'missing_rate';
    end if;

    select eh.id, eh.employment_type
    into v_employment_id, v_employment_type
    from public.bgm_staff_employment_type_history eh
    where eh.employee_id = v_session.employee_id
      and eh.effective_from <= v_work_date
    order by eh.effective_from desc, eh.created_at desc
    limit 1;

    if v_employment_id is null then
      return 'missing_employment';
    end if;

    v_work_date := v_work_date + 1;
  end loop;

  v_work_date := (v_session.clock_in_at at time zone 'Europe/Malta')::date;
  while v_work_date <= v_last_work_date loop
    v_day_start := v_work_date::timestamp at time zone 'Europe/Malta';
    v_day_end := (v_work_date + 1)::timestamp at time zone 'Europe/Malta';
    v_segment_start := greatest(v_session.clock_in_at, v_day_start);
    v_segment_end := least(v_session.clock_out_at, v_day_end);
    v_minutes := (extract(epoch from (v_segment_end - v_segment_start)) / 60)::integer;

    select r.id, r.hourly_rate_cents
    into v_rate_id, v_rate_cents
    from public.bgm_staff_rate_history r
    where r.employee_id = v_session.employee_id
      and r.effective_from <= v_work_date
    order by r.effective_from desc, r.created_at desc
    limit 1;

    select eh.id, eh.employment_type
    into v_employment_id, v_employment_type
    from public.bgm_staff_employment_type_history eh
    where eh.employee_id = v_session.employee_id
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
    join public.bgm_staff_public_holiday_versions hv on hv.holiday_id = h.id
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
      session_id, employee_id, work_date, worked_minutes,
      rate_history_id, hourly_rate_cents,
      employment_history_id, employment_type,
      holiday_version_id, holiday_multiplier_bps, pay_cents
    ) values (
      p_session_id, v_session.employee_id, v_work_date, v_minutes,
      v_rate_id, v_rate_cents,
      v_employment_id, v_employment_type,
      v_holiday_version_id, v_multiplier_bps, v_pay_cents
    );

    v_work_date := v_work_date + 1;
  end loop;

  return 'complete';
end;
$$;

revoke all on function public.bgm_staff_rebuild_session_payroll(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.bgm_staff_rebuild_session_payroll(uuid, timestamptz) to service_role;

-- Replace the midnight safeguard so auto-closed hours are calculated immediately while the session stays flagged.
create or replace function public.bgm_staff_auto_close_midnight_sessions(
  p_now timestamptz default now()
)
returns table (
  closed_session_id uuid,
  closed_employee_id uuid,
  effective_clock_out_at timestamptz,
  attendance_alert_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_event_id uuid;
  v_event_key text;
  v_alert_id uuid;
  v_payroll_result text;
begin
  for v_session in
    select
      s.id, s.employee_id, s.clock_in_at, s.clock_in_gym_id,
      (date_trunc('day', s.clock_in_at at time zone 'Europe/Malta') + interval '1 day')
        at time zone 'Europe/Malta' as cutoff_at
    from public.bgm_staff_work_sessions s
    where s.clock_out_at is null
      and s.status in ('open', 'needs_attention')
      and (date_trunc('day', s.clock_in_at at time zone 'Europe/Malta') + interval '1 day')
        at time zone 'Europe/Malta' <= p_now
    order by s.clock_in_at asc
    for update of s skip locked
  loop
    v_event_key := 'staff-midnight-auto-clock-out:' || v_session.id::text || ':' ||
      to_char(v_session.cutoff_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_event_id := null;

    insert into public.bgm_staff_punch_events (
      employee_id, action, source_timestamp, effective_minute_timestamp,
      gym_id, terminal_id, source, event_key, actor_system_user_id,
      manual_reason, metadata
    ) values (
      v_session.employee_id, 'out', p_now, v_session.cutoff_at,
      v_session.clock_in_gym_id, null, 'system', v_event_key, null,
      null, jsonb_build_object(
        'reason', 'midnight_auto_clock_out',
        'label', 'System – Midnight Auto Clock-Out',
        'effectiveClockOutAt', v_session.cutoff_at,
        'detectedAt', p_now,
        'contextGymSource', 'clock_in_gym'
      )
    )
    on conflict (event_key) do nothing
    returning id into v_event_id;

    if v_event_id is null then
      select pe.id into v_event_id
      from public.bgm_staff_punch_events pe
      where pe.event_key = v_event_key;
    end if;

    update public.bgm_staff_work_sessions
    set
      clock_out_at = v_session.cutoff_at,
      clock_out_gym_id = null,
      clock_out_terminal_id = null,
      clock_out_punch_event_id = v_event_id,
      status = 'needs_attention',
      attention_code = 'midnight_auto_clock_out',
      auto_closed_at = p_now,
      reviewed_at = null,
      reviewed_by_system_user_id = null,
      updated_at = p_now
    where id = v_session.id
      and clock_out_at is null;

    if found then
      v_payroll_result := public.bgm_staff_rebuild_session_payroll(v_session.id, p_now);

      insert into public.bgm_staff_attendance_alerts (
        session_id, employee_id, alert_type, status, message, effective_at
      ) values (
        v_session.id,
        v_session.employee_id,
        'midnight_auto_clock_out',
        'open',
        case
          when v_payroll_result = 'complete' then 'AUTO CLOCK-OUT AT MIDNIGHT — REVIEW REQUIRED'
          else 'AUTO CLOCK-OUT AT MIDNIGHT — REVIEW REQUIRED — PAYROLL HISTORY NEEDS ATTENTION'
        end,
        v_session.cutoff_at
      )
      on conflict (session_id, alert_type) do update
      set
        status = 'open',
        message = excluded.message,
        effective_at = excluded.effective_at,
        resolved_at = null,
        resolved_by_system_user_id = null
      returning id into v_alert_id;

      return query select v_session.id, v_session.employee_id, v_session.cutoff_at, v_alert_id;
    end if;
  end loop;
end;
$$;

-- Transactional correction/review. Raw punch evidence is intentionally never updated or deleted here.
create or replace function public.bgm_staff_correct_session(
  p_session_id uuid,
  p_clock_in_at timestamptz default null,
  p_clock_in_gym_id text default null,
  p_clock_out_at timestamptz default null,
  p_clock_out_gym_id text default null,
  p_reason text default null,
  p_actor_system_user_id uuid default null,
  p_review_midnight boolean default false
)
returns table (
  result_session_id uuid,
  result_status text,
  payroll_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_before jsonb;
  v_after jsonb;
  v_new_in timestamptz;
  v_new_out timestamptz;
  v_new_in_gym text;
  v_new_out_gym text;
  v_status text;
  v_payroll_status text := 'open';
  v_action_key text;
begin
  if p_actor_system_user_id is null then
    raise exception 'Super Admin actor is required.';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A correction reason is required.';
  end if;

  select s.* into v_session
  from public.bgm_staff_work_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'Staff attendance session not found.';
  end if;

  v_before := to_jsonb(v_session);
  v_new_in := coalesce(p_clock_in_at, v_session.clock_in_at);
  v_new_out := coalesce(p_clock_out_at, v_session.clock_out_at);
  v_new_in_gym := coalesce(nullif(btrim(coalesce(p_clock_in_gym_id, '')), ''), v_session.clock_in_gym_id);
  v_new_out_gym := coalesce(nullif(btrim(coalesce(p_clock_out_gym_id, '')), ''), v_session.clock_out_gym_id);

  if v_new_out is not null and v_new_out <= v_new_in then
    raise exception 'Corrected clock_out_at must be after clock_in_at.';
  end if;

  if not exists (select 1 from public.bgm_gyms g where g.id = v_new_in_gym) then
    raise exception 'Corrected clock-in gym does not exist.';
  end if;
  if v_new_out_gym is not null
    and not exists (select 1 from public.bgm_gyms g where g.id = v_new_out_gym)
  then
    raise exception 'Corrected clock-out gym does not exist.';
  end if;

  if exists (
    select 1
    from public.bgm_staff_work_sessions other
    where other.employee_id = v_session.employee_id
      and other.id <> v_session.id
      and other.status <> 'void'
      and tstzrange(
        other.clock_in_at,
        coalesce(other.clock_out_at, 'infinity'::timestamptz),
        '[)'
      ) && tstzrange(
        v_new_in,
        coalesce(v_new_out, 'infinity'::timestamptz),
        '[)'
      )
  ) then
    raise exception 'Corrected session would overlap another attendance session.';
  end if;

  if p_review_midnight then
    if v_session.attention_code is distinct from 'midnight_auto_clock_out' then
      raise exception 'Only a midnight auto clock-out can be reviewed this way.';
    end if;
    if v_new_in is distinct from v_session.clock_in_at
      or v_new_out is distinct from v_session.clock_out_at
      or v_new_in_gym is distinct from v_session.clock_in_gym_id
      or v_new_out_gym is distinct from v_session.clock_out_gym_id
    then
      raise exception 'Midnight review must not change attendance times or gyms.';
    end if;
    v_status := 'reviewed';
    v_action_key := 'staff.attendance.midnight_reviewed';
  else
    v_status := case when v_new_out is null then 'open' else 'corrected' end;
    v_action_key := 'staff.attendance.session_corrected';
  end if;

  update public.bgm_staff_work_sessions
  set
    clock_in_at = v_new_in,
    clock_in_gym_id = v_new_in_gym,
    clock_out_at = v_new_out,
    clock_out_gym_id = v_new_out_gym,
    status = v_status,
    attention_code = null,
    reviewed_at = case when p_review_midnight then now() else reviewed_at end,
    reviewed_by_system_user_id = case when p_review_midnight then p_actor_system_user_id else reviewed_by_system_user_id end,
    updated_by_system_user_id = p_actor_system_user_id,
    updated_at = now()
  where id = v_session.id;

  v_payroll_status := public.bgm_staff_rebuild_session_payroll(v_session.id, now());
  if v_new_out is not null and v_payroll_status in ('missing_rate', 'missing_employment') then
    update public.bgm_staff_work_sessions
    set status = 'needs_attention', attention_code = 'missing_payroll_history', updated_at = now()
    where id = v_session.id;
  end if;

  if v_session.attention_code = 'midnight_auto_clock_out' then
    update public.bgm_staff_attendance_alerts
    set
      status = 'resolved',
      resolved_at = now(),
      resolved_by_system_user_id = p_actor_system_user_id
    where session_id = v_session.id
      and alert_type = 'midnight_auto_clock_out'
      and status <> 'resolved';
  end if;

  select to_jsonb(s) into v_after
  from public.bgm_staff_work_sessions s
  where s.id = v_session.id;

  insert into public.bgm_staff_attendance_adjustments (
    session_id, employee_id, before_data, after_data, reason,
    actor_system_user_id, created_at
  ) values (
    v_session.id, v_session.employee_id, v_before, v_after,
    btrim(p_reason), p_actor_system_user_id, now()
  );

  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, before_data, after_data
  ) values (
    p_actor_system_user_id, v_new_in_gym, null, v_action_key,
    'staff_attendance_session', v_session.id::text, v_before, v_after
  );

  return query
  select v_session.id,
    (v_after ->> 'status')::text,
    v_payroll_status;
end;
$$;

revoke all on function public.bgm_staff_correct_session(
  uuid, timestamptz, text, timestamptz, text, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.bgm_staff_correct_session(
  uuid, timestamptz, text, timestamptz, text, text, uuid, boolean
) to service_role;
