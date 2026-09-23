-- Super Admin-only member archive/restore. Membership contracts and history are never altered.
alter table public.bgm_members
 add column if not exists archived_at timestamptz,
 add column if not exists archived_by uuid references public.bgm_system_users(id) on delete set null,
 add column if not exists archived_previous_status text,
 add column if not exists archived_reason text;

create or replace function public.bgm_super_admin_member_archive_restore(
 p_system_user_id uuid, p_member_id uuid, p_expected_updated_at timestamptz,
 p_action text, p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_before public.bgm_members%rowtype;
 v_after public.bgm_members%rowtype;
 v_today date := (now() at time zone 'Europe/Malta')::date;
 v_status text;
begin
 if not exists (select 1 from public.bgm_system_users
   where id=p_system_user_id and active=true and is_super_admin=true) then
   raise exception 'Super Admin access required.';
 end if;
 if p_member_id is null or p_expected_updated_at is null or p_action not in ('archive','restore')
   or length(coalesce(p_reason,''))>500 then
   raise exception 'Invalid member archive or restore request.';
 end if;
 select * into v_before from public.bgm_members where id=p_member_id for update;
 if not found then raise exception 'Member not found.'; end if;
 if v_before.updated_at is distinct from p_expected_updated_at then
   raise exception 'Member record changed. Reload before changing account status.';
 end if;
 if p_action='archive' then
   if v_before.status='archived' or v_before.archived_at is not null then
     raise exception 'Member is already archived.';
   end if;
   -- Do not leave one partner archived while their joint contract is still active.
   if exists (
     select 1 from public.bgm_membership_members l
       join public.bgm_memberships ms on ms.id=l.membership_id
     where l.member_id=p_member_id and ms.membership_type='couples' and ms.status='active'
   ) then
     raise exception 'Shared active couples membership: review both partners and close the shared contract before archiving.';
   end if;
   update public.bgm_members set
     archived_previous_status=status, archived_at=clock_timestamp(), archived_by=p_system_user_id,
     archived_reason=nullif(btrim(coalesce(p_reason,'')),''),
     status='archived', updated_at=clock_timestamp()
     where id=p_member_id returning * into v_after;
 else
   if v_before.status<>'archived' or v_before.archived_at is null then
     raise exception 'Only archived members can be restored.';
   end if;
   -- Restoring the record is not renewal and must not reverse cancellation.
   v_status := case
     when v_before.archived_previous_status='active'
       and (v_before.membership_expiry is null or v_before.membership_expiry>=v_today)
       and (v_before.cancellation_effective_date is null or v_before.cancellation_effective_date>v_today)
       and not exists (
         select 1 from public.bgm_membership_members l
          join public.bgm_memberships ms on ms.id=l.membership_id
         where l.member_id=p_member_id and ms.expiry_date=v_before.membership_expiry
           and ms.status='cancelled'
       )
       then 'active'
     else 'inactive' end;
   update public.bgm_members set status=v_status,
     archived_previous_status=null, archived_at=null, archived_by=null, archived_reason=null,
     updated_at=clock_timestamp() where id=p_member_id returning * into v_after;
 end if;
 insert into public.bgm_audit_log
   (system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values (p_system_user_id,v_before.enrollment_gym_id,
   case when p_action='archive' then 'member.account.archive' else 'member.account.restore' end,
   'member',p_member_id::text,p_member_id,
   jsonb_build_object('memberNumber',v_before.member_number,'status',v_before.status,
      'archivedAt',v_before.archived_at,'cancellationEffectiveDate',v_before.cancellation_effective_date),
   jsonb_build_object('memberNumber',v_after.member_number,'status',v_after.status,
      'archivedAt',v_after.archived_at,'cancellationEffectiveDate',v_after.cancellation_effective_date,
      'reason',nullif(btrim(coalesce(p_reason,'')),''))
 );
 return jsonb_build_object('status',v_after.status,'archivedAt',v_after.archived_at,
   'updatedAt',v_after.updated_at,'memberNumber',v_after.member_number);
end;
$$;
revoke all on function public.bgm_super_admin_member_archive_restore(uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.bgm_super_admin_member_archive_restore(uuid,uuid,timestamptz,text,text)
 to service_role;
