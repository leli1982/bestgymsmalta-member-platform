create table if not exists public.bgm_member_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete cascade,
  notification_type text not null default 'general',
  title text not null,
  body text not null,
  href text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists bgm_member_notifications_member_dedupe_idx
  on public.bgm_member_notifications(member_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists bgm_member_notifications_member_created_idx
  on public.bgm_member_notifications(member_id, created_at desc);

create index if not exists bgm_member_notifications_member_unread_idx
  on public.bgm_member_notifications(member_id, read_at)
  where read_at is null;

alter table public.bgm_member_notifications enable row level security;
