-- BestGymsMalta staff attendance: automatic Malta-midnight clock-out safeguard.
-- Apply to TEST first. Production rollout remains a separate approval checkpoint.

alter table public.bgm_staff_punch_events
  drop constraint if exists bgm_staff_punch_events_source_check;

alter table public.bgm_staff_punch_events
  drop constraint if exists bgm_staff_punch_events_check;

alter table public.bgm_staff_punch_events
  add constraint bgm_staff_punch_events_source_check
  check (source in ('terminal', 'manual', 'system'));

alter table public.bgm_staff_punch_events
  add constraint bgm_staff_punch_events_terminal_source_check
  check (
    (source = 'terminal' and terminal_id is not null)
    or source in ('manual', 'system')
  );

alter table public.bgm_staff_work_sessions
  drop constraint if exists bgm_staff_work_sessions_status_check;

alter table public.bgm_staff_work_sessions
  add constraint bgm_staff_work_sessions_status_check
  check (status in ('open', 'closed', 'needs_attention', 'corrected', 'reviewed', 'void'));

alter table public.bgm_staff_work_sessions
  add column if not exists attention_code text,
  add column if not exists auto_closed_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_system_user_id uuid references public.bgm_system_users(id) on delete set null;

alter table public.bgm_staff_work_sessions
  drop constraint if exists bgm_staff_work_sessions_attention_code_check;

alter table public.bgm_staff_work_sessions
  add constraint bgm_staff_work_sessions_attention_code_check
  check (attention_code is null or attention_code in ('midnight_auto_clock_out'));

create table if not exists public.bgm_staff_attendance_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bgm_staff_work_sessions(id) on delete restrict,
  employee_id uuid not null references public.bgm_staff_employees(id) on delete restrict,
  alert_type text not null check (alert_type in ('midnight_auto_clock_out')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  message text not null check (btrim(message) <> ''),
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  unique (session_id, alert_type),
  check ((status = 'resolved' and resolved_at is not null) or status = 'open')
);

create index if not exists bgm_staff_attendance_alerts_open_created_idx
  on public.bgm_staff_attendance_alerts(status, created_at desc);
create index if not exists bgm_staff_attendance_alerts_employee_created_idx
  on public.bgm_staff_attendance_alerts(employee_id, created_at desc);

alter table public.bgm_staff_attendance_alerts enable row level security;
revoke all on public.bgm_staff_attendance_alerts from public, anon, authenticated;
grant all on public.bgm_staff_attendance_alerts to service_role;

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
        'AUTO CLOCK-OUT AT MIDNIGHT — REVIEW REQUIRED',
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
