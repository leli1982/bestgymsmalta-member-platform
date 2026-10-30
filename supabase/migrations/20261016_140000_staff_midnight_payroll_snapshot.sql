-- BestGymsMalta staff attendance: persist historical payroll snapshot during Malta-midnight auto clock-out.
-- Follow-up migration: preserves the already-applied midnight migration and reuses the canonical payroll rebuild logic.
-- Apply to TEST first. Production rollout remains a separate approval checkpoint.

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
  v_payroll_status text;
  v_alert_message text;
begin
  for v_session in
    select
      s.id,
      s.employee_id,
      s.clock_in_at,
      s.clock_in_gym_id,
      (
        date_trunc('day', s.clock_in_at at time zone 'Europe/Malta') + interval '1 day'
      ) at time zone 'Europe/Malta' as cutoff_at
    from public.bgm_staff_work_sessions s
    where s.clock_out_at is null
      and s.status in ('open', 'needs_attention')
      and (
        date_trunc('day', s.clock_in_at at time zone 'Europe/Malta') + interval '1 day'
      ) at time zone 'Europe/Malta' <= p_now
    order by s.clock_in_at asc
    for update of s skip locked
  loop
    v_event_key := 'staff-midnight-auto-clock-out:' || v_session.id::text || ':' ||
      to_char(v_session.cutoff_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_event_id := null;
    v_payroll_status := null;
    v_alert_message := 'AUTO CLOCK-OUT AT MIDNIGHT — REVIEW REQUIRED';

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
      v_session.employee_id,
      'out',
      p_now,
      v_session.cutoff_at,
      v_session.clock_in_gym_id,
      null,
      'system',
      v_event_key,
      null,
      null,
      jsonb_build_object(
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
      select pe.id
      into v_event_id
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
      -- The canonical rebuild function freezes rate, employment type, holiday version,
      -- multiplier, worked minutes and pay for the closed Malta work date. This is the
      -- same persisted payroll snapshot used by normal/corrected attendance flows.
      v_payroll_status := public.bgm_staff_rebuild_session_payroll(v_session.id, p_now);

      if v_payroll_status in ('missing_rate', 'missing_employment') then
        -- Keep the midnight attention code so Super Admin can still review the automatic
        -- close through the existing workflow, while making the payroll-history problem
        -- explicit in the alert. No partial payroll snapshot is written by the rebuild.
        v_alert_message := 'AUTO CLOCK-OUT AT MIDNIGHT — REVIEW REQUIRED — ' ||
          'PAYROLL SNAPSHOT UNAVAILABLE: missing_payroll_history (' || v_payroll_status || ')';
      end if;

      insert into public.bgm_staff_attendance_alerts (
        session_id,
        employee_id,
        alert_type,
        status,
        message,
        effective_at
      )
      values (
        v_session.id,
        v_session.employee_id,
        'midnight_auto_clock_out',
        'open',
        v_alert_message,
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

      return query
      select v_session.id, v_session.employee_id, v_session.cutoff_at, v_alert_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.bgm_staff_auto_close_midnight_sessions(timestamptz) from public, anon, authenticated;
grant execute on function public.bgm_staff_auto_close_midnight_sessions(timestamptz) to service_role;
