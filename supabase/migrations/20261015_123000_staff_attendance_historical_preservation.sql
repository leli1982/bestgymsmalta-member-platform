-- BestGymsMalta staff attendance: preserve historical payroll configuration during attendance corrections.
-- Existing Malta-date portions reuse their persisted payroll snapshot. Only newly introduced dates resolve fresh config.
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
  v_existing_segment public.bgm_staff_session_payroll_segments%rowtype;
  v_first_work_date date;
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

  if v_session.clock_out_at is null then
    delete from public.bgm_staff_session_payroll_segments
    where session_id = p_session_id;
    return 'open';
  end if;

  if v_session.clock_out_at < v_session.clock_in_at then
    raise exception 'Clock-out cannot be before clock-in.';
  end if;

  if v_session.clock_out_at = v_session.clock_in_at then
    delete from public.bgm_staff_session_payroll_segments
    where session_id = p_session_id;
    return 'complete';
  end if;

  v_first_work_date := (v_session.clock_in_at at time zone 'Europe/Malta')::date;
  v_last_work_date := ((v_session.clock_out_at - interval '1 microsecond') at time zone 'Europe/Malta')::date;

  -- Preflight only newly introduced Malta dates. Existing dates already have authoritative
  -- rate/employment/holiday snapshots and must not silently adopt later configuration.
  v_work_date := v_first_work_date;
  while v_work_date <= v_last_work_date loop
    v_existing_segment := null;
    select ps.*
    into v_existing_segment
    from public.bgm_staff_session_payroll_segments ps
    where ps.session_id = p_session_id
      and ps.work_date = v_work_date;

    if v_existing_segment.id is null then
      v_rate_id := null;
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

      v_employment_id := null;
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
    end if;

    v_work_date := v_work_date + 1;
  end loop;

  v_work_date := v_first_work_date;
  while v_work_date <= v_last_work_date loop
    v_day_start := v_work_date::timestamp at time zone 'Europe/Malta';
    v_day_end := (v_work_date + 1)::timestamp at time zone 'Europe/Malta';
    v_segment_start := greatest(v_session.clock_in_at, v_day_start);
    v_segment_end := least(v_session.clock_out_at, v_day_end);
    v_minutes := (extract(epoch from (v_segment_end - v_segment_start)) / 60)::integer;

    v_existing_segment := null;
    select ps.*
    into v_existing_segment
    from public.bgm_staff_session_payroll_segments ps
    where ps.session_id = p_session_id
      and ps.work_date = v_work_date;

    if v_existing_segment.id is null then
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
    else
      -- Same date as the original calculation: retain the immutable configuration snapshot.
      v_rate_id := v_existing_segment.rate_history_id;
      v_rate_cents := v_existing_segment.hourly_rate_cents;
      v_employment_id := v_existing_segment.employment_history_id;
      v_employment_type := v_existing_segment.employment_type;
      v_holiday_version_id := v_existing_segment.holiday_version_id;
      v_multiplier_bps := v_existing_segment.holiday_multiplier_bps;
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
    )
    on conflict (session_id, work_date) do update
    set
      worked_minutes = excluded.worked_minutes,
      pay_cents = excluded.pay_cents;

    v_work_date := v_work_date + 1;
  end loop;

  -- A correction may remove a previously existing Malta-date portion. The old segment values
  -- are captured in the immutable adjustment before_data before this delete occurs.
  delete from public.bgm_staff_session_payroll_segments
  where session_id = p_session_id
    and (work_date < v_first_work_date or work_date > v_last_work_date);

  return 'complete';
end;
$$;

revoke all on function public.bgm_staff_rebuild_session_payroll(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.bgm_staff_rebuild_session_payroll(uuid, timestamptz) to service_role;

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

  select jsonb_build_object(
    'session', to_jsonb(v_session),
    'payrollSegments', coalesce(
      (select jsonb_agg(to_jsonb(ps) order by ps.work_date)
       from public.bgm_staff_session_payroll_segments ps
       where ps.session_id = v_session.id),
      '[]'::jsonb
    )
  ) into v_before;

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

  select jsonb_build_object(
    'session', to_jsonb(s),
    'payrollSegments', coalesce(
      (select jsonb_agg(to_jsonb(ps) order by ps.work_date)
       from public.bgm_staff_session_payroll_segments ps
       where ps.session_id = s.id),
      '[]'::jsonb
    )
  ) into v_after
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
    (v_after -> 'session' ->> 'status')::text,
    v_payroll_status;
end;
$$;

revoke all on function public.bgm_staff_correct_session(
  uuid, timestamptz, text, timestamptz, text, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.bgm_staff_correct_session(
  uuid, timestamptz, text, timestamptz, text, text, uuid, boolean
) to service_role;
