-- Permanent deletion is allowed only for unused inactive/archived member profiles
-- with no historic, financial, identity, access, photo, or audit dependencies.
-- This does NOT erase external exports, database backups, or records under retention.
create or replace function public.bgm_super_admin_member_delete_assessment(
 p_system_user_id uuid, p_member_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_member public.bgm_members%rowtype;
 v_blockers jsonb := '[]'::jsonb;
begin
 if not exists (select 1 from public.bgm_system_users
   where id=p_system_user_id and active=true and is_super_admin=true) then
   raise exception 'Super Admin access required.';
 end if;
 select * into v_member from public.bgm_members where id=p_member_id;
 if not found then raise exception 'Member not found.'; end if;

 if v_member.status='active' then
   v_blockers:=v_blockers||to_jsonb('Active member: deactivate the account before considering deletion.'::text);
 end if;
 if v_member.app_enrolled or v_member.password_hash is not null then
   v_blockers:=v_blockers||to_jsonb('Activated member app account.'::text);
 end if;
 if v_member.official_photo_path is not null then
   v_blockers:=v_blockers||to_jsonb('Official photo stored for the member.'::text);
 end if;
 if v_member.legacy_pk_customer is not null or v_member.legacy_gym is not null then
   v_blockers:=v_blockers||to_jsonb('Imported legacy identity or source record.'::text);
 end if;
 if exists(select 1 from public.bgm_membership_members where member_id=p_member_id) then
   v_blockers:=v_blockers||to_jsonb('Membership contracts, including any shared couples contracts or payment-linked applications.'::text);
 end if;
 if exists(select 1 from public.bgm_membership_application_members
   where existing_member_id=p_member_id or matched_member_id=p_member_id) then
   v_blockers:=v_blockers||to_jsonb('Membership application or renewal records.'::text);
 end if;
 if exists(select 1 from public.bgm_member_card_credentials where member_id=p_member_id)
   or exists(select 1 from public.bgm_nfc_cards where member_id=p_member_id) then
   v_blockers:=v_blockers||to_jsonb('Assigned or historic physical credentials.'::text);
 end if;
 if exists(select 1 from public.bgm_member_official_photos where member_id=p_member_id) then
   v_blockers:=v_blockers||to_jsonb('Official photo history and storage.'::text);
 end if;
 if exists(select 1 from public.bgm_member_import_rows where matched_member_id=p_member_id) then
   v_blockers:=v_blockers||to_jsonb('Imported member reconciliation history.'::text);
 end if;
 if exists(select 1 from public.bgm_access_scans where member_id=p_member_id)
   or exists(select 1 from public.bgm_member_checkins
        where member_id in (p_member_id::text,v_member.member_number)) then
   v_blockers:=v_blockers||to_jsonb('Visit or access-scan history.'::text);
 end if;
 if exists(select 1 from public.bgm_member_stats where member_id=p_member_id) then
   v_blockers:=v_blockers||to_jsonb('Member activity and statistics.'::text);
 end if;
 if exists(select 1 from public.bgm_audit_log
   where member_id=p_member_id or entity_id=p_member_id::text
     or coalesce(before_data::text,'') like '%'||v_member.member_number||'%'
     or coalesce(after_data::text,'') like '%'||v_member.member_number||'%') then
   v_blockers:=v_blockers||to_jsonb('Existing audit history or retained identity references.'::text);
 end if;
 return jsonb_build_object('eligible',jsonb_array_length(v_blockers)=0,
   'blockers',v_blockers,'memberNumber',v_member.member_number,'fullName',v_member.full_name,
   'status',v_member.status,'updatedAt',v_member.updated_at);
end;
$$;
revoke all on function public.bgm_super_admin_member_delete_assessment(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.bgm_super_admin_member_delete_assessment(uuid,uuid)
 to service_role;

create or replace function public.bgm_super_admin_member_delete(
 p_system_user_id uuid, p_member_id uuid, p_expected_updated_at timestamptz,
 p_confirmed_member_number text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_member public.bgm_members%rowtype;
 v_assessment jsonb;
begin
 if not exists (select 1 from public.bgm_system_users
   where id=p_system_user_id and active=true and is_super_admin=true) then
   raise exception 'Super Admin access required.';
 end if;
 if p_member_id is null or p_expected_updated_at is null or p_confirmed_member_number is null then
   raise exception 'Invalid permanent deletion request.';
 end if;
 select * into v_member from public.bgm_members where id=p_member_id for update;
 if not found then raise exception 'Member not found.'; end if;
 if v_member.updated_at is distinct from p_expected_updated_at
   or v_member.member_number is distinct from p_confirmed_member_number then
   raise exception 'Member record changed or confirmation mismatched. Reload before deleting.';
 end if;
 v_assessment:=public.bgm_super_admin_member_delete_assessment(p_system_user_id,p_member_id);
 if v_assessment->>'eligible' <> 'true' then
   raise exception 'Permanent deletion blocked by linked or retained records. Reload eligibility.';
 end if;
 delete from public.bgm_members where id=p_member_id;
 if not found then raise exception 'Member deletion was not confirmed.'; end if;
 -- Record the privileged operation without retaining this deleted person's identifiers.
 insert into public.bgm_audit_log
   (system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
 values (p_system_user_id,v_member.enrollment_gym_id,'member.account.delete',
   'member_deletion',null,null,
   jsonb_build_object('recordType','member','verifiedNoDependencies',true),
   jsonb_build_object('deleted',true));
 return jsonb_build_object('deleted',true);
end;
$$;
revoke all on function public.bgm_super_admin_member_delete(uuid,uuid,timestamptz,text)
 from public,anon,authenticated;
grant execute on function public.bgm_super_admin_member_delete(uuid,uuid,timestamptz,text)
 to service_role;
