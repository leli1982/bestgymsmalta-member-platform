-- Internal Staff Portal urgent notices only. Does not touch member-facing data.
create table if not exists public.bgm_urgent_staff_alerts (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(btrim(subject)) between 1 and 160),
  message text not null check (length(btrim(message)) between 1 and 4000),
  priority text not null check (priority in ('urgent', 'emergency')),
  target_scope text not null check (target_scope in ('all', 'gym')),
  created_by_system_user_id uuid not null references public.bgm_system_users(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by_system_user_id uuid references public.bgm_system_users(id),
  revision integer not null default 1 check (revision > 0),
  constraint bgm_urgent_staff_alert_cancel_consistency
    check ((cancelled_at is null) = (cancelled_by_system_user_id is null))
);

create table if not exists public.bgm_urgent_staff_alert_recipients (
  alert_id uuid not null references public.bgm_urgent_staff_alerts(id) on delete cascade,
  gym_id text not null references public.bgm_gyms(id) on delete restrict,
  read_by text check (read_by is null or length(btrim(read_by)) between 1 and 100),
  acknowledged_at timestamptz,
  acknowledged_by_system_user_id uuid references public.bgm_system_users(id),
  primary key (alert_id, gym_id),
  constraint bgm_urgent_staff_alert_ack_consistency check (
    (acknowledged_at is null and read_by is null and acknowledged_by_system_user_id is null)
    or
    (acknowledged_at is not null and read_by is not null and acknowledged_by_system_user_id is not null)
  )
);

create index if not exists bgm_urgent_staff_alerts_created_idx
  on public.bgm_urgent_staff_alerts(created_at desc);
create index if not exists bgm_urgent_staff_recipients_pending_idx
  on public.bgm_urgent_staff_alert_recipients(gym_id, alert_id)
  where acknowledged_at is null;

alter table public.bgm_urgent_staff_alerts enable row level security;
alter table public.bgm_urgent_staff_alert_recipients enable row level security;
revoke all on public.bgm_urgent_staff_alerts from public, anon, authenticated;
revoke all on public.bgm_urgent_staff_alert_recipients from public, anon, authenticated;
grant select, insert, update, delete on public.bgm_urgent_staff_alerts to service_role;
grant select, insert, update, delete on public.bgm_urgent_staff_alert_recipients to service_role;

-- An atomic send creates one acknowledgement slot per active staff-enabled gym.
create or replace function public.bgm_create_urgent_staff_alert(
  p_subject text, p_message text, p_priority text, p_target_gym_id text,
  p_all_gyms boolean, p_sender uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_alert_id uuid;
  v_recipient_count integer;
begin
  if not exists (
    select 1 from public.bgm_system_users u
    where u.id = p_sender and u.active = true
      and (u.is_super_admin = true or u.role = 'super_admin')
  ) then
    raise exception 'Super Admin access required.';
  end if;
  if length(btrim(coalesce(p_subject, ''))) not between 1 and 160
     or length(btrim(coalesce(p_message, ''))) not between 1 and 4000
     or p_priority not in ('urgent', 'emergency')
     or p_all_gyms is null
     or (p_all_gyms and p_target_gym_id is not null)
     or (not p_all_gyms and nullif(btrim(coalesce(p_target_gym_id,'')), '') is null)
  then
    raise exception 'Invalid urgent alert.';
  end if;

  insert into public.bgm_urgent_staff_alerts
    (subject, message, priority, target_scope, created_by_system_user_id)
  values (btrim(p_subject), btrim(p_message), p_priority,
    case when p_all_gyms then 'all' else 'gym' end, p_sender)
  returning id into v_alert_id;

  insert into public.bgm_urgent_staff_alert_recipients(alert_id, gym_id)
  select v_alert_id, g.id
  from public.bgm_gyms g
  where g.status = 'active'
    and (p_all_gyms or g.id = p_target_gym_id)
    and exists (
      select 1 from public.bgm_system_users u
      where u.gym_id = g.id and u.active = true and u.role = 'gym_staff'
    );
  get diagnostics v_recipient_count = row_count;
  if v_recipient_count = 0 then
    raise exception 'No active Staff Portal account exists for the selected gym(s).';
  end if;

  insert into public.bgm_audit_log
    (system_user_id, action_key, entity_type, entity_id, after_data)
  values (p_sender, 'urgent_staff_alert.sent', 'urgent_staff_alert',
    v_alert_id::text,
    pg_catalog.jsonb_build_object('subject', btrim(p_subject),
      'priority', p_priority, 'targetScope', case when p_all_gyms then 'all' else 'gym' end,
      'targetGymId', p_target_gym_id, 'recipientCount', v_recipient_count));
  return v_alert_id;
end;
$$;

create or replace function public.bgm_acknowledge_urgent_staff_alert(
  p_alert_id uuid, p_gym_id text, p_staff_user_id uuid, p_read_by text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_read_by text := btrim(coalesce(p_read_by, ''));
  v_updated uuid;
begin
  if length(v_read_by) not between 1 and 100 then return false; end if;
  if not exists (
    select 1 from public.bgm_system_users u
    where u.id = p_staff_user_id and u.role = 'gym_staff'
      and u.active = true and u.gym_id = p_gym_id
  ) then return false; end if;

  update public.bgm_urgent_staff_alert_recipients r
  set read_by = v_read_by, acknowledged_at = now(),
    acknowledged_by_system_user_id = p_staff_user_id
  where r.alert_id = p_alert_id and r.gym_id = p_gym_id
    and r.acknowledged_at is null
    and exists (
      select 1 from public.bgm_urgent_staff_alerts a
      where a.id = r.alert_id and a.cancelled_at is null
    )
  returning r.alert_id into v_updated;

  if v_updated is not null then
    insert into public.bgm_audit_log
      (system_user_id, context_gym_id, staff_name, action_key, entity_type, entity_id, after_data)
    values (p_staff_user_id, p_gym_id, v_read_by, 'urgent_staff_alert.acknowledged',
      'urgent_staff_alert', p_alert_id::text,
      pg_catalog.jsonb_build_object('gymId', p_gym_id, 'readBy', v_read_by));
    return true;
  end if;

  -- Same request can be retried after a lost HTTP response, without overwriting its audit record.
  return exists (
    select 1 from public.bgm_urgent_staff_alert_recipients r
    join public.bgm_urgent_staff_alerts a on a.id = r.alert_id
    where r.alert_id = p_alert_id and r.gym_id = p_gym_id
      and a.cancelled_at is null and r.read_by = v_read_by
      and r.acknowledged_by_system_user_id = p_staff_user_id
      and r.acknowledged_at is not null
  );
end;
$$;

create or replace function public.bgm_cancel_urgent_staff_alert(
  p_alert_id uuid, p_super_user_id uuid
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_updated uuid;
begin
  if not exists (
    select 1 from public.bgm_system_users u
    where u.id = p_super_user_id and u.active = true
      and (u.is_super_admin = true or u.role = 'super_admin')
  ) then return false; end if;

  update public.bgm_urgent_staff_alerts
  set cancelled_at = now(), cancelled_by_system_user_id = p_super_user_id
  where id = p_alert_id and cancelled_at is null
  returning id into v_updated;
  if v_updated is null then return false; end if;

  insert into public.bgm_audit_log
    (system_user_id, action_key, entity_type, entity_id, after_data)
  values (p_super_user_id, 'urgent_staff_alert.cancelled', 'urgent_staff_alert',
    p_alert_id::text, pg_catalog.jsonb_build_object('cancelled', true));
  return true;
end;
$$;

revoke all on function public.bgm_create_urgent_staff_alert(text,text,text,text,boolean,uuid) from public, anon, authenticated;
revoke all on function public.bgm_acknowledge_urgent_staff_alert(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.bgm_cancel_urgent_staff_alert(uuid,uuid) from public, anon, authenticated;
grant execute on function public.bgm_create_urgent_staff_alert(text,text,text,text,boolean,uuid) to service_role;
grant execute on function public.bgm_acknowledge_urgent_staff_alert(uuid,text,uuid,text) to service_role;
grant execute on function public.bgm_cancel_urgent_staff_alert(uuid,uuid) to service_role;
