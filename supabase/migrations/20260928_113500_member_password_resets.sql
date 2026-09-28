create table if not exists public.bgm_member_password_resets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bgm_member_password_resets_member_created_idx
  on public.bgm_member_password_resets(member_id, created_at desc);

alter table public.bgm_member_password_resets enable row level security;

revoke all on table public.bgm_member_password_resets from anon, authenticated;
grant select, insert, update, delete on table public.bgm_member_password_resets to service_role;
