-- C3 member engagement push notifications.
-- Additive server-managed tables. Global engagement remains disabled by default.

create table if not exists public.bgm_member_notification_preferences (
  member_id uuid primary key references public.bgm_members(id) on delete cascade,
  critical_enabled boolean not null default true,
  motivational_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bgm_member_engagement_settings (
  id text primary key check (id = 'member_engagement'),
  enabled boolean not null default false,
  inactivity_enabled boolean not null default true,
  streak_enabled boolean not null default true,
  updated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.bgm_member_engagement_settings (
  id,
  enabled,
  inactivity_enabled,
  streak_enabled
)
values ('member_engagement', false, true, true)
on conflict (id) do nothing;

create table if not exists public.bgm_member_engagement_notification_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete cascade,
  event_type text not null check (event_type in ('inactivity','streak')),
  event_key text not null,
  event_date date not null,
  status text not null check (status in ('pending','sent','skipped','failed')),
  reason text,
  error_text text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, event_key)
);

create index if not exists bgm_member_engagement_notification_log_member_idx
  on public.bgm_member_engagement_notification_log (member_id, event_date desc);
create index if not exists bgm_member_engagement_notification_log_status_idx
  on public.bgm_member_engagement_notification_log (status, attempted_at desc);

alter table public.bgm_member_notification_preferences enable row level security;
alter table public.bgm_member_engagement_settings enable row level security;
alter table public.bgm_member_engagement_notification_log enable row level security;

-- C3 accesses these tables only from authenticated Next.js server routes/engines.
-- Make the Data API boundary explicit even on projects that still grant new
-- public tables to anon/authenticated by default.
revoke all on table public.bgm_member_notification_preferences from anon, authenticated;
revoke all on table public.bgm_member_engagement_settings from anon, authenticated;
revoke all on table public.bgm_member_engagement_notification_log from anon, authenticated;

grant select, insert, update, delete on table public.bgm_member_notification_preferences to service_role;
grant select, insert, update, delete on table public.bgm_member_engagement_settings to service_role;
grant select, insert, update, delete on table public.bgm_member_engagement_notification_log to service_role;
