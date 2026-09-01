-- BestGymsMalta Phase 2 configurable order notifications and Web Push subscriptions.

create table if not exists public.bgm_notification_settings (
  id text primary key check (id = 'orders'),
  orders_email text not null check (btrim(orders_email) <> ''),
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  updated_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.bgm_notification_settings (
  id,
  orders_email,
  email_enabled,
  push_enabled
)
values (
  'orders',
  'info@bestgymsmalta.com',
  true,
  true
)
on conflict (id) do nothing;

create table if not exists public.bgm_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  system_user_id uuid not null references public.bgm_system_users(id) on delete cascade,
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

create index if not exists bgm_push_subscriptions_system_user_id_idx
  on public.bgm_push_subscriptions (system_user_id);

create index if not exists bgm_push_subscriptions_active_idx
  on public.bgm_push_subscriptions (active)
  where active = true;

alter table public.bgm_notification_settings enable row level security;
alter table public.bgm_push_subscriptions enable row level security;
