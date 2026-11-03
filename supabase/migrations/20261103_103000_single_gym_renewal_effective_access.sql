-- Future-dated renewals must not change today's access scope at payment activation.
-- Queue the renewal scope on the permanent member and let access evaluators apply
-- it from the renewal start date.

alter table public.bgm_members
  add column if not exists pending_access_scope text,
  add column if not exists pending_access_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  add column if not exists pending_access_effective_date date;

alter table public.bgm_members
  drop constraint if exists bgm_members_pending_access_scope_check;
alter table public.bgm_members
  add constraint bgm_members_pending_access_scope_check
  check (pending_access_scope is null or pending_access_scope in ('network', 'single_gym'));

alter table public.bgm_members
  drop constraint if exists bgm_members_pending_access_target_check;
alter table public.bgm_members
  add constraint bgm_members_pending_access_target_check
  check (
    (pending_access_scope is null and pending_access_gym_id is null and pending_access_effective_date is null)
    or (pending_access_scope = 'network' and pending_access_gym_id is null and pending_access_effective_date is not null)
    or (pending_access_scope = 'single_gym' and pending_access_gym_id is not null and pending_access_effective_date is not null)
  );

create index if not exists bgm_members_pending_access_effective_idx
  on public.bgm_members(pending_access_effective_date)
  where pending_access_scope is not null;

create or replace function public.bgm_sync_activated_membership_access_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Malta')::date;
begin
  if new.status = 'activated'
    and old.status is distinct from new.status then

    if new.application_kind = 'new' then
      update public.bgm_members member
      set access_scope = new.access_scope,
          access_gym_id = new.access_gym_id,
          pending_access_scope = null,
          pending_access_gym_id = null,
          pending_access_effective_date = null,
          updated_at = now()
      where member.id in (
        select membership_member.member_id
        from public.bgm_memberships membership
        join public.bgm_membership_members membership_member
          on membership_member.membership_id = membership.id
        where membership.application_id = new.id
      );

    elsif new.application_kind = 'renewal' then
      if new.start_date <= v_today then
        update public.bgm_members member
        set access_scope = new.access_scope,
            access_gym_id = new.access_gym_id,
            pending_access_scope = null,
            pending_access_gym_id = null,
            pending_access_effective_date = null,
            updated_at = now()
        where member.id in (
          select membership_member.member_id
          from public.bgm_memberships membership
          join public.bgm_membership_members membership_member
            on membership_member.membership_id = membership.id
          where membership.application_id = new.id
        );
      else
        update public.bgm_members member
        set pending_access_scope = new.access_scope,
            pending_access_gym_id = new.access_gym_id,
            pending_access_effective_date = new.start_date,
            updated_at = now()
        where member.id in (
          select membership_member.member_id
          from public.bgm_memberships membership
          join public.bgm_membership_members membership_member
            on membership_member.membership_id = membership.id
          where membership.application_id = new.id
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.bgm_sync_activated_membership_access_scope() from public, anon, authenticated;
grant execute on function public.bgm_sync_activated_membership_access_scope() to service_role;
