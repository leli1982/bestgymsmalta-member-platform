-- Membership expiry reminder settings, audit log and member push subscriptions.
-- Renewal reminders are enabled by default. Super Admin can still disable the
-- master switch or individual channels/timings from notification settings.

create table if not exists public.bgm_membership_reminder_settings (
  id text primary key check (id = 'membership_expiry'),
  enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  day_1_enabled boolean not null default true,
  day_7_enabled boolean not null default true,
  day_14_enabled boolean not null default true,
  day_21_enabled boolean not null default true,
  day_30_enabled boolean not null default true,
  updated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.bgm_membership_reminder_settings (
  id,
  enabled,
  email_enabled,
  push_enabled,
  day_1_enabled,
  day_7_enabled,
  day_14_enabled,
  day_21_enabled,
  day_30_enabled
)
values (
  'membership_expiry',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
)
on conflict (id) do nothing;

create table if not exists public.bgm_member_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete cascade,
  endpoint text not null,
  p256dh text not null check (btrim(p256dh) <> ''),
  auth text not null check (btrim(auth) <> ''),
  device_label text,
  active boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists bgm_member_push_subscriptions_member_id_idx
  on public.bgm_member_push_subscriptions (member_id);

create index if not exists bgm_member_push_subscriptions_active_idx
  on public.bgm_member_push_subscriptions (active)
  where active = true;

create table if not exists public.bgm_membership_reminder_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete cascade,
  membership_expiry date not null,
  days_before integer not null check (days_before in (1,7,14,21,30)),
  channel text not null check (channel in ('email','push')),
  status text not null check (status in ('pending','sent','skipped','failed')),
  reason text,
  error_text text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, membership_expiry, days_before, channel)
);

create index if not exists bgm_membership_reminder_log_created_at_idx
  on public.bgm_membership_reminder_log (created_at desc);

create index if not exists bgm_membership_reminder_log_status_idx
  on public.bgm_membership_reminder_log (status);

alter table public.bgm_membership_reminder_settings enable row level security;
alter table public.bgm_member_push_subscriptions enable row level security;
alter table public.bgm_membership_reminder_log enable row level security;
