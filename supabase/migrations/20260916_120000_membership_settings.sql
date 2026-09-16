-- BestGymsMalta membership pricing, declarations and discount settings.
-- Server-side only: all public tables are RLS-enabled and exposed only to service_role.

create table if not exists public.bgm_membership_price_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  version_no bigint generated always as identity unique,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.bgm_membership_price_entries (
  catalog_version_id uuid not null references public.bgm_membership_price_catalog_versions(id) on delete cascade,
  membership_type text not null check (membership_type in ('single','student','couples')),
  duration_key text not null check (duration_key in ('1_week','2_weeks','1_month','3_months','6_months','1_year')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  primary key (catalog_version_id, membership_type, duration_key)
);

create table if not exists public.bgm_membership_declaration_versions (
  id uuid primary key default gen_random_uuid(),
  content_key text not null check (content_key in ('gym_rules','legacy_declaration','privacy','health','guardian')),
  version_no bigint not null,
  body text not null check (length(btrim(body)) > 0),
  content_sha256 text not null check (btrim(content_sha256) <> ''),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(content_key, version_no)
);

create table if not exists public.bgm_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (btrim(code) <> ''),
  percentage integer not null check (percentage between 1 and 100),
  active boolean not null default true,
  valid_from date,
  valid_until date,
  max_uses integer check (max_uses is null or max_uses > 0),
  successful_uses integer not null default 0 check (successful_uses >= 0),
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create unique index if not exists bgm_membership_one_published_price_catalog_idx
  on public.bgm_membership_price_catalog_versions ((status))
  where status = 'published';

create unique index if not exists bgm_membership_one_published_declaration_per_key_idx
  on public.bgm_membership_declaration_versions (content_key)
  where status = 'published';

create unique index if not exists bgm_discount_codes_normalized_code_key
  on public.bgm_discount_codes (upper(btrim(code)));

create index if not exists bgm_membership_price_entries_catalog_idx
  on public.bgm_membership_price_entries (catalog_version_id);
create index if not exists bgm_membership_declarations_key_status_idx
  on public.bgm_membership_declaration_versions (content_key, status, version_no desc);
create index if not exists bgm_discount_codes_active_idx
  on public.bgm_discount_codes (active, upper(btrim(code)));

alter table public.bgm_membership_price_catalog_versions enable row level security;
alter table public.bgm_membership_price_entries enable row level security;
alter table public.bgm_membership_declaration_versions enable row level security;
alter table public.bgm_discount_codes enable row level security;

revoke all on table public.bgm_membership_price_catalog_versions from anon, authenticated;
revoke all on table public.bgm_membership_price_entries from anon, authenticated;
revoke all on table public.bgm_membership_declaration_versions from anon, authenticated;
revoke all on table public.bgm_discount_codes from anon, authenticated;

grant select, insert, update, delete on table public.bgm_membership_price_catalog_versions to service_role;
grant select, insert, update, delete on table public.bgm_membership_price_entries to service_role;
grant select, insert, update, delete on table public.bgm_membership_declaration_versions to service_role;
grant select, insert, update, delete on table public.bgm_discount_codes to service_role;
grant usage, select on sequence public.bgm_membership_price_catalog_versions_version_no_seq to service_role;

create or replace function public.bgm_reject_published_membership_setting_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_table_name = 'bgm_membership_price_entries' then
    select status into v_status
    from public.bgm_membership_price_catalog_versions
    where id = old.catalog_version_id;

    if v_status in ('published', 'retired') then
      raise exception 'Published membership price entries are immutable.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'bgm_membership_price_catalog_versions' then
    if old.status in ('published', 'retired') then
      if tg_op = 'DELETE' then
        raise exception 'Published membership price catalogs cannot be deleted.';
      end if;
      if old.status = 'published'
         and new.status = 'retired'
         and new.id = old.id
         and new.version_no = old.version_no
         and new.published_at is not distinct from old.published_at
         and new.created_by_system_user_id is not distinct from old.created_by_system_user_id
         and new.created_at is not distinct from old.created_at then
        return new;
      end if;
      raise exception 'Published membership price catalogs are immutable.';
    end if;
    return new;
  end if;

  if tg_table_name = 'bgm_membership_declaration_versions' then
    if old.status in ('published', 'retired') then
      if tg_op = 'DELETE' then
        raise exception 'Published membership declarations cannot be deleted.';
      end if;
      if old.status = 'published'
         and new.status = 'retired'
         and new.id = old.id
         and new.content_key = old.content_key
         and new.version_no = old.version_no
         and new.body = old.body
         and new.content_sha256 = old.content_sha256
         and new.published_at is not distinct from old.published_at
         and new.created_by_system_user_id is not distinct from old.created_by_system_user_id
         and new.created_at is not distinct from old.created_at then
        return new;
      end if;
      raise exception 'Published membership declarations are immutable.';
    end if;
    return new;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger bgm_membership_price_entries_immutable_published
before update or delete on public.bgm_membership_price_entries
for each row execute function public.bgm_reject_published_membership_setting_mutation();

create trigger bgm_membership_price_catalog_immutable_published
before update or delete on public.bgm_membership_price_catalog_versions
for each row execute function public.bgm_reject_published_membership_setting_mutation();

create trigger bgm_membership_declaration_immutable_published
before update or delete on public.bgm_membership_declaration_versions
for each row execute function public.bgm_reject_published_membership_setting_mutation();

create or replace function public.bgm_publish_membership_price_catalog(
  p_catalog_version_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.bgm_membership_price_catalog_versions%rowtype;
  v_entry_count integer;
  v_old_id uuid;
begin
  select * into v_target
  from public.bgm_membership_price_catalog_versions
  where id = p_catalog_version_id
  for update;

  if not found then
    raise exception 'Membership price catalog not found.';
  end if;
  if v_target.status <> 'draft' then
    raise exception 'Only a draft membership price catalog can be published.';
  end if;
  if p_system_user_id is null then
    raise exception 'System user is required.';
  end if;

  select count(*) into v_entry_count
  from public.bgm_membership_price_entries
  where catalog_version_id = p_catalog_version_id;

  if v_entry_count <> 18 then
    raise exception 'A complete price catalog must contain exactly 18 entries.';
  end if;

  select id into v_old_id
  from public.bgm_membership_price_catalog_versions
  where status = 'published'
  for update;

  if v_old_id is not null then
    update public.bgm_membership_price_catalog_versions
    set status = 'retired'
    where id = v_old_id;
  end if;

  update public.bgm_membership_price_catalog_versions
  set status = 'published', published_at = now()
  where id = p_catalog_version_id;

  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, before_data, after_data
  ) values (
    p_system_user_id, null, null, 'membership_prices_published',
    'membership_price_catalog', p_catalog_version_id::text,
    case when v_old_id is null then null else jsonb_build_object('retiredCatalogId', v_old_id) end,
    jsonb_build_object('catalogVersionId', p_catalog_version_id, 'versionNo', v_target.version_no, 'status', 'published')
  );

  return jsonb_build_object('ok', true, 'catalogVersionId', p_catalog_version_id, 'versionNo', v_target.version_no);
end;
$$;

create or replace function public.bgm_publish_membership_declaration(
  p_declaration_version_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.bgm_membership_declaration_versions%rowtype;
  v_old_id uuid;
begin
  select * into v_target
  from public.bgm_membership_declaration_versions
  where id = p_declaration_version_id
  for update;

  if not found then
    raise exception 'Membership declaration not found.';
  end if;
  if v_target.status <> 'draft' then
    raise exception 'Only a draft membership declaration can be published.';
  end if;
  if p_system_user_id is null then
    raise exception 'System user is required.';
  end if;

  select id into v_old_id
  from public.bgm_membership_declaration_versions
  where content_key = v_target.content_key
    and status = 'published'
  for update;

  if v_old_id is not null then
    update public.bgm_membership_declaration_versions
    set status = 'retired'
    where id = v_old_id;
  end if;

  update public.bgm_membership_declaration_versions
  set status = 'published', published_at = now()
  where id = p_declaration_version_id;

  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, before_data, after_data
  ) values (
    p_system_user_id, null, null, 'membership_declaration_published',
    'membership_declaration', p_declaration_version_id::text,
    case when v_old_id is null then null else jsonb_build_object('retiredDeclarationId', v_old_id) end,
    jsonb_build_object('contentKey', v_target.content_key, 'versionNo', v_target.version_no, 'contentSha256', v_target.content_sha256, 'status', 'published')
  );

  return jsonb_build_object('ok', true, 'declarationVersionId', p_declaration_version_id, 'contentKey', v_target.content_key, 'versionNo', v_target.version_no);
end;
$$;

revoke all on function public.bgm_reject_published_membership_setting_mutation() from public, anon, authenticated;
revoke all on function public.bgm_publish_membership_price_catalog(uuid, uuid) from public, anon, authenticated;
revoke all on function public.bgm_publish_membership_declaration(uuid, uuid) from public, anon, authenticated;

grant execute on function public.bgm_publish_membership_price_catalog(uuid, uuid) to service_role;
grant execute on function public.bgm_publish_membership_declaration(uuid, uuid) to service_role;
