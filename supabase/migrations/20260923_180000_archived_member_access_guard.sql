-- Archived members cannot be made active by a renewal or card workflow while
-- archive metadata still exists. Restoring clears the metadata atomically.
create or replace function public.bgm_guard_archived_member_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.archived_at is not null and new.status <> 'archived' then
   raise exception 'Archived member: restore the account through Super Admin before changing membership status.';
 end if;
 if old.archived_at is not null and new.archived_at is not null
   and new.status <> 'archived' then
   raise exception 'Archived member cannot be activated by a normal membership update.';
 end if;
 return new;
end;
$$;
drop trigger if exists bgm_archived_member_status_guard on public.bgm_members;
create trigger bgm_archived_member_status_guard
before insert or update on public.bgm_members
for each row execute function public.bgm_guard_archived_member_status();

create or replace function public.bgm_guard_archived_member_membership_link()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if exists(select 1 from public.bgm_members
   where id=new.member_id and (status='archived' or archived_at is not null)) then
   raise exception 'Archived member: restore the account through Super Admin before renewal.';
 end if;
 return new;
end;
$$;
drop trigger if exists bgm_archived_member_link_guard on public.bgm_membership_members;
create trigger bgm_archived_member_link_guard
before insert on public.bgm_membership_members
for each row execute function public.bgm_guard_archived_member_membership_link();
