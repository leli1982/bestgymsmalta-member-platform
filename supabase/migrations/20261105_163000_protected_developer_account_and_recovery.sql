-- Protected Developer account. TEST first; Production requires explicit owner approval.
-- Ordinary Super Admin / bootstrap-admin API never exposes protected accounts.
alter table public.bgm_system_users
  add column if not exists is_protected_developer boolean not null default false,
  add column if not exists developer_password_changed_at timestamptz;

create unique index if not exists bgm_one_protected_developer_idx
  on public.bgm_system_users (is_protected_developer)
  where is_protected_developer = true;

alter table public.bgm_system_users
  add constraint bgm_protected_developer_is_super_admin
  check (not is_protected_developer or
    (is_super_admin = true and role = 'super_admin' and active = true and gym_id is null));

create or replace function public.bgm_guard_protected_developer()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.is_protected_developer then
      raise exception 'Protected Developer account cannot be deleted through system administration.';
    end if;
    return old;
  end if;

  if old.is_protected_developer then
    if new.id is distinct from old.id
      or new.username is distinct from old.username
      or new.display_name is distinct from old.display_name
      or new.gym_id is distinct from old.gym_id
      or new.role is distinct from old.role
      or new.is_super_admin is distinct from old.is_super_admin
      or new.active is distinct from old.active
      or new.is_protected_developer is distinct from old.is_protected_developer
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Protected Developer account details cannot be changed through system administration.';
    end if;
    if (new.password_hash is distinct from old.password_hash
      or new.developer_password_changed_at is distinct from old.developer_password_changed_at)
      and coalesce(current_setting('bgm.developer_password_reset_authorized', true), '') <> 'yes'
    then
      raise exception 'Protected Developer password may only be reset through verified recovery.';
    end if;
  end if;
  return new;
end $$;

create trigger bgm_protected_developer_row_guard
  before update or delete on public.bgm_system_users
  for each row execute function public.bgm_guard_protected_developer();

create table if not exists public.bgm_developer_password_resets (
  token_hash text primary key check (length(token_hash) = 64),
  system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint bgm_dev_reset_expiry check (expires_at > created_at)
);
create index if not exists bgm_dev_password_resets_user_created_idx
  on public.bgm_developer_password_resets(system_user_id,created_at desc);
alter table public.bgm_developer_password_resets enable row level security;
revoke all on public.bgm_developer_password_resets from public, anon, authenticated;
grant select, insert, update, delete on public.bgm_developer_password_resets to service_role;

-- A token is consumed atomically. Only the server's service role can call this RPC.
create or replace function public.bgm_consume_developer_password_reset(
  p_token_hash text, p_password_hash text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.bgm_developer_password_resets%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_password_hash is null or length(p_password_hash) < 55
  then
    return false;
  end if;
  select * into v_request
  from public.bgm_developer_password_resets
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > clock_timestamp()
  for update;
  if not found then return false; end if;
  if not exists(select 1 from public.bgm_system_users
    where id=v_request.system_user_id and is_protected_developer=true and active=true)
  then return false; end if;

  perform set_config('bgm.developer_password_reset_authorized', 'yes', true);
  update public.bgm_system_users
    set password_hash=p_password_hash,
        developer_password_changed_at=clock_timestamp(),
        updated_at=clock_timestamp()
    where id=v_request.system_user_id and is_protected_developer=true;
  if not found then raise exception 'Developer account not found'; end if;
  update public.bgm_developer_password_resets set used_at=clock_timestamp()
    where system_user_id=v_request.system_user_id and used_at is null;
  return true;
end $$;
revoke all on function public.bgm_consume_developer_password_reset(text,text) from public, anon, authenticated;
grant execute on function public.bgm_consume_developer_password_reset(text,text) to service_role;
