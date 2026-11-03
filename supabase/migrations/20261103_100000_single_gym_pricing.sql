-- Generalise Neptunes-only access into reusable per-gym membership access and pricing.
-- Existing network pricing remains network-scoped. This first migration is deliberately
-- backward-compatible: legacy neptunes_only remains valid until generic code is live.

alter table public.bgm_gyms
  add column if not exists single_gym_pricing_enabled boolean not null default false;

update public.bgm_gyms
set single_gym_pricing_enabled = true
where id = 'bgm-neptunes';

alter table public.bgm_members
  add column if not exists access_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict;

alter table public.bgm_membership_applications
  add column if not exists access_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict;

alter table public.bgm_members
  drop constraint if exists bgm_members_access_scope_check;
alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_access_scope_check;

-- Backfill the generic target without changing the legacy scope yet. This keeps the
-- currently deployed scanner code safe while the schema is introduced first.
update public.bgm_members
set access_gym_id = 'bgm-neptunes',
    updated_at = now()
where access_scope = 'neptunes_only'
  and access_gym_id is null;

update public.bgm_membership_applications
set access_gym_id = 'bgm-neptunes'
where access_scope = 'neptunes_only'
  and access_gym_id is null;

alter table public.bgm_members
  add constraint bgm_members_access_scope_check
  check (access_scope in ('network', 'neptunes_only', 'single_gym'));
alter table public.bgm_members
  add constraint bgm_members_access_target_check
  check (
    (access_scope = 'network' and access_gym_id is null)
    or (access_scope in ('neptunes_only', 'single_gym') and access_gym_id is not null)
  );

alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_access_scope_check
  check (access_scope in ('network', 'neptunes_only', 'single_gym'));
alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_access_target_check
  check (
    (access_scope = 'network' and access_gym_id is null)
    or (access_scope in ('neptunes_only', 'single_gym') and access_gym_id is not null)
  );

create index if not exists bgm_members_access_gym_idx
  on public.bgm_members(access_gym_id)
  where access_scope in ('neptunes_only', 'single_gym');
create index if not exists bgm_membership_applications_access_gym_idx
  on public.bgm_membership_applications(access_gym_id)
  where access_scope in ('neptunes_only', 'single_gym');

alter table public.bgm_membership_price_catalog_versions
  add column if not exists access_scope text not null default 'network';
alter table public.bgm_membership_price_catalog_versions
  add column if not exists gym_id text references public.bgm_gyms(id) on update cascade on delete restrict;

alter table public.bgm_membership_price_catalog_versions
  drop constraint if exists bgm_membership_price_catalog_scope_check;
alter table public.bgm_membership_price_catalog_versions
  add constraint bgm_membership_price_catalog_scope_check
  check (
    (access_scope = 'network' and gym_id is null)
    or (access_scope = 'single_gym' and gym_id is not null)
  );

alter table public.bgm_membership_price_catalog_versions
  drop constraint if exists bgm_membership_price_catalog_access_scope_check;
alter table public.bgm_membership_price_catalog_versions
  add constraint bgm_membership_price_catalog_access_scope_check
  check (access_scope in ('network', 'single_gym'));

drop index if exists public.bgm_membership_one_published_price_catalog_idx;
create unique index if not exists bgm_membership_one_published_network_price_catalog_idx
  on public.bgm_membership_price_catalog_versions ((status))
  where status = 'published' and access_scope = 'network' and gym_id is null;
create unique index if not exists bgm_membership_one_published_single_gym_price_catalog_idx
  on public.bgm_membership_price_catalog_versions (gym_id)
  where status = 'published' and access_scope = 'single_gym';
create index if not exists bgm_membership_price_catalog_scope_lookup_idx
  on public.bgm_membership_price_catalog_versions(access_scope, gym_id, status, version_no desc);

create or replace function public.bgm_reject_published_price_catalog_scope_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('published', 'retired')
     and (new.access_scope is distinct from old.access_scope
          or new.gym_id is distinct from old.gym_id) then
    raise exception 'Published membership price catalog scope is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_membership_price_catalog_scope_immutable
  on public.bgm_membership_price_catalog_versions;
create trigger bgm_membership_price_catalog_scope_immutable
before update on public.bgm_membership_price_catalog_versions
for each row execute function public.bgm_reject_published_price_catalog_scope_mutation();

revoke all on function public.bgm_reject_published_price_catalog_scope_mutation() from public, anon, authenticated;
grant execute on function public.bgm_reject_published_price_catalog_scope_mutation() to service_role;

create or replace function public.bgm_publish_membership_price_catalog(
  p_catalog_version_id uuid,
  p_system_user_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_target public.bgm_membership_price_catalog_versions%rowtype;
  v_entry_count integer;
  v_old_id uuid;
begin
  select * into v_target
  from public.bgm_membership_price_catalog_versions
  where id = p_catalog_version_id
  for update;

  if not found then raise exception 'Membership price catalog not found.'; end if;
  if v_target.status <> 'draft' then raise exception 'Only a draft membership price catalog can be published.'; end if;
  if p_system_user_id is null then raise exception 'System user is required.'; end if;
  if v_target.access_scope = 'single_gym' and v_target.gym_id is null then raise exception 'Single Gym pricing requires a gym.'; end if;

  select count(*) into v_entry_count
  from public.bgm_membership_price_entries
  where catalog_version_id = p_catalog_version_id;

  if v_entry_count <> 21 then
    raise exception 'A complete price catalog must contain exactly 21 entries.';
  end if;

  select id into v_old_id
  from public.bgm_membership_price_catalog_versions
  where status = 'published'
    and access_scope = v_target.access_scope
    and gym_id is not distinct from v_target.gym_id
  for update;

  if v_old_id is not null then
    update public.bgm_membership_price_catalog_versions set status = 'retired' where id = v_old_id;
  end if;

  update public.bgm_membership_price_catalog_versions
  set status = 'published', published_at = now()
  where id = p_catalog_version_id;

  insert into public.bgm_audit_log(
    system_user_id, context_gym_id, staff_name, action_key,
    entity_type, entity_id, before_data, after_data
  ) values (
    p_system_user_id, v_target.gym_id, null, 'membership_prices_published',
    'membership_price_catalog', p_catalog_version_id::text,
    case when v_old_id is null then null else jsonb_build_object('retiredCatalogId', v_old_id) end,
    jsonb_build_object('catalogVersionId', p_catalog_version_id, 'versionNo', v_target.version_no,
      'status', 'published', 'accessScope', v_target.access_scope, 'gymId', v_target.gym_id)
  );

  return jsonb_build_object('ok', true, 'catalogVersionId', p_catalog_version_id,
    'versionNo', v_target.version_no, 'accessScope', v_target.access_scope, 'gymId', v_target.gym_id);
end;
$function$;

-- Activation can safely carry the new target once application creation starts using it.
create or replace function public.bgm_sync_activated_membership_access_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'activated'
    and old.status is distinct from new.status
    and new.application_kind = 'new' then
    update public.bgm_members member
    set access_scope = new.access_scope,
        access_gym_id = new.access_gym_id,
        updated_at = now()
    where member.id in (
      select membership_member.member_id
      from public.bgm_memberships membership
      join public.bgm_membership_members membership_member
        on membership_member.membership_id = membership.id
      where membership.application_id = new.id
    );
  end if;
  return new;
end;
$$;
