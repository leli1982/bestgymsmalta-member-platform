-- Gym Manager role foundation.
-- Applied and verified on TEST first. Production remains untouched until controlled release.

alter table public.bgm_system_users
  add column if not exists role text;

update public.bgm_system_users
set role = case when is_super_admin then 'super_admin' else 'gym_staff' end
where role is null;

alter table public.bgm_system_users
  alter column role set default 'gym_staff',
  alter column role set not null;

alter table public.bgm_system_users
  drop constraint if exists bgm_system_users_role_check;

alter table public.bgm_system_users
  add constraint bgm_system_users_role_check
  check (role in ('gym_staff', 'gym_manager', 'super_admin'));

create table if not exists public.bgm_manager_gym_assignments (
  manager_user_id uuid not null references public.bgm_system_users(id) on delete cascade,
  gym_id text not null references public.bgm_gyms(id) on update cascade on delete restrict,
  assigned_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (manager_user_id, gym_id)
);

create index if not exists bgm_manager_gym_assignments_gym_id_idx
  on public.bgm_manager_gym_assignments (gym_id);

alter table public.bgm_manager_gym_assignments enable row level security;

-- Manager assignments are server-only. Explicit grants are required for new
-- public tables as Supabase tightens Data API exposure defaults in 2026.
revoke all on table public.bgm_manager_gym_assignments from anon, authenticated;
grant select, insert, update, delete on table public.bgm_manager_gym_assignments to service_role;
