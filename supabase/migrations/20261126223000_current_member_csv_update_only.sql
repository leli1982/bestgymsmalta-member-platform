-- Dedicated current-member CSV update workflow. Never imports or deletes members.
create table public.bgm_current_csv_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.bgm_system_users(id),
  created_at timestamptz not null default now(),
  source_rows integer not null check(source_rows>=0 and source_rows<=100000),
  expected_edits integer not null check(expected_edits>=0 and expected_edits<=source_rows),
  status text not null default 'preview' check(status in ('preview','applied')),
  applied_at timestamptz
);
create table public.bgm_current_csv_edits (
  batch_id uuid not null references public.bgm_current_csv_batches(id),
  member_id uuid not null,
  member_number text not null,
  row_number integer not null check(row_number>=2),
  edit jsonb not null,
  issue text,
  primary key(batch_id,member_id),
  unique(batch_id,member_number),
  unique(batch_id,row_number)
);
alter table public.bgm_current_csv_batches enable row level security;
alter table public.bgm_current_csv_edits enable row level security;
revoke all on public.bgm_current_csv_batches,public.bgm_current_csv_edits from public,anon,authenticated;
grant select,insert,update on public.bgm_current_csv_batches,public.bgm_current_csv_edits to service_role;

create or replace function public.bgm_validate_current_csv_edit(p_staff_id uuid,p_edit jsonb,p_apply boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  m public.bgm_members%rowtype;
  t public.bgm_memberships%rowtype;
  p jsonb := p_edit->'patch';
  v_id uuid := (p_edit->>'memberId')::uuid;
  v_keys text[] := array['FullName','FirstName','LastName','CompanyName','Address1','Address2','Town','PostCode','Country','Gender','DateOfBirth','IDNumber','NextOfKin','Email','Mobile','Phone','TelephoneNo1','TelephoneNo2','Notes','EnrollmentGymId','MembershipType','MembershipDuration','MembershipStartDate','MembershipEndDate','MemberExpiryDate','EnrollmentDate','Status','LegacyMembershipPeriod'];
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_first text; v_last text; v_name text;
  v_links integer; v_matches integer; v_participants integer;
  v_terms boolean; v_dates boolean; v_kind boolean;
  v_start date; v_end date; v_enrollment date; v_type text; v_duration text;
  v_status text; v_term_status text; v_gym text; v_revision timestamptz;
  v_result jsonb; v_requested_status text;
begin
  if not exists(select 1 from public.bgm_system_users where id=p_staff_id and active and is_super_admin)
  then raise exception 'Super Admin access required.'; end if;
  if p is null or jsonb_typeof(p)<>'object' or p='{}'::jsonb or exists(
    select 1 from jsonb_each(p) f where not(f.key=any(v_keys)) or jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>500
  ) then raise exception 'Invalid or protected CSV edit fields.'; end if;
  if p_apply then select * into m from public.bgm_members where id=v_id for update;
  else select * into m from public.bgm_members where id=v_id; end if;
  if not found or m.member_number is distinct from p_edit->>'memberNumber'
  then raise exception 'Permanent member ID and BGM number do not match an existing member.'; end if;
  if m.updated_at is distinct from (p_edit->>'expectedUpdatedAt')::timestamptz
  then raise exception 'Member changed after export. Download a fresh CSV; newer data is protected.'; end if;
  v_first:=case when p?'FirstName' then nullif(btrim(p->>'FirstName'),'') else m.first_name end;
  v_last:=case when p?'LastName' then nullif(btrim(p->>'LastName'),'') else m.last_name end;
  v_name:=case when p?'FullName' then nullif(btrim(p->>'FullName'),'') else m.full_name end;
  if p?|array['FirstName','LastName'] then
    if v_first is null or v_last is null or length(v_first)>100 or length(v_last)>100
    then raise exception 'Enter both first and last names, maximum 100 characters each.'; end if;
    if p?'FullName' and v_name is distinct from v_first||' '||v_last
    then raise exception 'Full name must agree with the edited first and last names.'; end if;
    v_name:=v_first||' '||v_last;
  elsif p?'FullName' then
    if v_name is null or length(v_name)>200 then raise exception 'Enter a valid full name.'; end if;
    if nullif(btrim(m.first_name),'') is not null and nullif(btrim(m.last_name),'') is not null
      and v_name is distinct from btrim(m.first_name)||' '||btrim(m.last_name)
    then raise exception 'Edit FirstName and LastName together for a structured member name.'; end if;
  end if;
  if p?'Email' and (length(p->>'Email')>254 or (nullif(btrim(p->>'Email'),'') is not null and btrim(p->>'Email')!~*'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
  then raise exception 'Enter a valid email address.'; end if;
  if exists(select 1 from jsonb_each_text(p) f where f.key=any(array['DateOfBirth','MembershipStartDate','MembershipEndDate','MemberExpiryDate','EnrollmentDate']) and f.value<>'' and f.value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  then raise exception 'Use full ISO calendar dates.'; end if;
  if p?'DateOfBirth' and nullif(p->>'DateOfBirth','')::date>v_today
  then raise exception 'Date of birth cannot be in the future.'; end if;
  if p?'IDNumber' and nullif(btrim(p->>'IDNumber'),'') is not null and exists(
    select 1 from public.bgm_members x where x.id<>m.id and x.archived_at is null and upper(regexp_replace(coalesce(x.id_number,''),'[^[:alnum:]]','','g'))=upper(regexp_replace(p->>'IDNumber','[^[:alnum:]]','','g'))
  ) then raise exception 'ID number already belongs to another member. Review the identity manually.'; end if;
  v_gym:=case when p?'EnrollmentGymId' then nullif(btrim(p->>'EnrollmentGymId'),'') else m.enrollment_gym_id end;
  if p?'EnrollmentGymId' and not exists(select 1 from public.bgm_gyms where id=v_gym and status='active')
  then raise exception 'Select an active enrollment gym ID.'; end if;

  v_dates:=p?|array['MembershipStartDate','MembershipEndDate','MemberExpiryDate','EnrollmentDate'];
  v_kind:=p?|array['MembershipType','MembershipDuration'];
  v_terms:=v_dates or v_kind or p?'Status' or p?'LegacyMembershipPeriod';
  v_status:=m.status;
  v_end:=m.membership_expiry;
  v_enrollment:=m.enrollment_date;
  if (v_terms or p?'EnrollmentGymId' or p?'LegacyMembershipPeriod') and m.archived_at is not null
  then raise exception 'Archived membership terms must be reviewed through the existing archive/restore workflow.'; end if;
  if v_terms then
    select count(*) into v_links from public.bgm_membership_members where member_id=m.id;
    if v_links>0 then
      select count(*) into v_matches from public.bgm_membership_members l join public.bgm_memberships z on z.id=l.membership_id
        where l.member_id=m.id and z.status<>'cancelled' and z.expiry_date is not distinct from m.membership_expiry;
      if v_matches<>1 then raise exception 'Current linked membership is ambiguous or cancelled. Review the member individually.'; end if;
      if p_apply then
        select z.* into t from public.bgm_membership_members l join public.bgm_memberships z on z.id=l.membership_id
          where l.member_id=m.id and z.status<>'cancelled' and z.expiry_date is not distinct from m.membership_expiry for update of z;
      else
        select z.* into t from public.bgm_membership_members l join public.bgm_memberships z on z.id=l.membership_id
          where l.member_id=m.id and z.status<>'cancelled' and z.expiry_date is not distinct from m.membership_expiry;
      end if;
      if t.id is distinct from nullif(p_edit->>'expectedTermId','')::uuid or t.updated_at is distinct from nullif(p_edit->>'expectedTermUpdatedAt','')::timestamptz
      then raise exception 'Linked membership changed after export. Download a fresh CSV.'; end if;
      select count(*) into v_participants from public.bgm_membership_members where membership_id=t.id;
      if v_participants<>1 then raise exception 'Shared membership requires a joint correction; no partner is changed by CSV.'; end if;
      v_start:=t.start_date; v_type:=t.membership_type; v_duration:=t.duration_key; v_term_status:=t.status;
      if p?'LegacyMembershipPeriod' and not(p?'MembershipDuration') and nullif(p->>'LegacyMembershipPeriod','') is distinct from t.duration_key
      then raise exception 'Edit MembershipDuration for a linked membership, not the legacy period.'; end if;
    else
      if nullif(p_edit->>'expectedTermId','') is not null then raise exception 'Membership link changed. Download a fresh CSV.'; end if;
      if v_kind then raise exception 'No structured membership type or duration exists for this legacy record. Review individually; no paid membership will be invented.'; end if;
      v_start:=m.enrollment_date;
    end if;
    if p?'MembershipStartDate' then v_start:=nullif(p->>'MembershipStartDate','')::date; end if;
    if p?'MembershipEndDate' then v_end:=nullif(p->>'MembershipEndDate','')::date; end if;
    if p?'MemberExpiryDate' then
      if p?'MembershipEndDate' and v_end is distinct from nullif(p->>'MemberExpiryDate','')::date
      then raise exception 'MembershipEndDate and MemberExpiryDate must agree.'; end if;
      v_end:=nullif(p->>'MemberExpiryDate','')::date;
    end if;
    if p?'EnrollmentDate' then
      v_enrollment:=nullif(p->>'EnrollmentDate','')::date;
      if v_links=0 then
        if p?'MembershipStartDate' and v_start is distinct from v_enrollment then raise exception 'Legacy start and enrollment dates must agree.'; end if;
        v_start:=v_enrollment;
      elsif m.enrollment_date is not distinct from t.start_date then
        if p?'MembershipStartDate' and v_start is distinct from v_enrollment then raise exception 'Enrollment date and matching current start date must agree.'; end if;
        v_start:=v_enrollment;
      end if;
    end if;
    if v_dates and (v_end is null or (v_start is not null and v_end<v_start) or (v_links>0 and v_start is null))
    then raise exception 'Enter valid membership dates. Expiry cannot precede start.'; end if;
    if v_kind then
      if p?'MembershipType' then v_type:=lower(btrim(p->>'MembershipType')); end if;
      if p?'MembershipDuration' then v_duration:=lower(btrim(p->>'MembershipDuration')); end if;
      if v_type not in ('single','student') or v_duration not in ('1_session','1_week','2_weeks','1_month','3_months','6_months','1_year')
        or (v_type='student' and v_duration='2_weeks')
      then raise exception 'Invalid type/duration or shared membership. Review individually.'; end if;
      if p?'LegacyMembershipPeriod' and nullif(p->>'LegacyMembershipPeriod','') is distinct from v_duration
      then raise exception 'MembershipDuration and LegacyMembershipPeriod must agree.'; end if;
      if coalesce(t.voucher_extension_months_snapshot,0)>0 or exists(select 1 from public.bgm_membership_applications a where a.id=t.application_id and nullif(a.discount_code_snapshot,'') is not null)
      then raise exception 'Voucher-linked membership type/duration requires individual correction; original terms are protected.'; end if;
    end if;
    if p?'Status' then
      v_requested_status:=lower(btrim(p->>'Status'));
      if v_requested_status not in ('active','expired') then raise exception 'Status must be Active or Expired. Archive and cancellation are separate operations.'; end if;
      if v_requested_status='active' then
        if v_end is null or v_end<v_today or (v_start is not null and v_start>v_today)
          or (m.cancellation_effective_date is not null and m.cancellation_effective_date<=v_today)
        then raise exception 'Active status requires a current valid expiry and no effective cancellation.'; end if;
        v_status:='active';
        if v_links>0 then v_term_status:='active'; end if;
      else
        if v_end is not null and v_end>=v_today and (m.cancellation_effective_date is null or m.cancellation_effective_date>v_today)
        then raise exception 'Expired status requires a past expiry or an existing effective cancellation.'; end if;
        v_status:='inactive';
        if v_links>0 then v_term_status:='expired'; end if;
      end if;
    elsif v_dates and m.status='inactive' and v_end>=v_today and (v_start is null or v_start<=v_today)
      and (m.cancellation_effective_date is null or m.cancellation_effective_date>v_today)
      and (v_links=0 or t.status='active') then
      v_status:='active';
    end if;
  end if;
  if not p_apply then return jsonb_build_object('valid',true); end if;

  -- Domain-specific date correction updates the canonical term and member together.
  if v_dates then
    v_result:=public.bgm_super_admin_correct_member_dates(p_staff_id,m.id,m.updated_at,t.id,t.updated_at,v_start,v_end);
    select updated_at,enrollment_date into v_revision,v_enrollment from public.bgm_members where id=m.id;
    if p?'EnrollmentDate' then v_enrollment:=nullif(p->>'EnrollmentDate','')::date; end if;
  else v_revision:=m.updated_at; end if;
  if v_terms and v_links>0 and (v_kind or (p?'Status' and v_term_status is distinct from t.status)) then
    update public.bgm_memberships set membership_type=v_type,duration_key=v_duration,status=v_term_status,updated_at=clock_timestamp()
      where id=t.id;
  end if;
  if p?'EnrollmentGymId' and v_gym is distinct from m.enrollment_gym_id then
    v_result:=public.bgm_super_admin_change_member_enrollment_gym(p_staff_id,m.id,v_revision,v_gym);
  end if;
  -- Explicit field-level updates only; all omitted values, IDs, financial rows,
  -- photos, credentials, membership links and audit history remain in place.
  update public.bgm_members set
    full_name=v_name,first_name=v_first,last_name=v_last,
    company_name=case when p?'CompanyName' then nullif(p->>'CompanyName','') else company_name end,
    address_line_1=case when p?'Address1' then nullif(p->>'Address1','') else address_line_1 end,
    address_line_2=case when p?'Address2' then nullif(p->>'Address2','') else address_line_2 end,
    town=case when p?'Town' then nullif(p->>'Town','') else town end,
    postcode=case when p?'PostCode' then nullif(p->>'PostCode','') else postcode end,
    country=case when p?'Country' then nullif(p->>'Country','') else country end,
    gender=case when p?'Gender' then nullif(p->>'Gender','') else gender end,
    date_of_birth=case when p?'DateOfBirth' then nullif(p->>'DateOfBirth','')::date else date_of_birth end,
    id_number=case when p?'IDNumber' then nullif(p->>'IDNumber','') else id_number end,
    next_of_kin=case when p?'NextOfKin' then nullif(p->>'NextOfKin','') else next_of_kin end,
    email=case when p?'Email' then nullif(btrim(p->>'Email'),'') else email end,
    mobile=case when p?'Mobile' then nullif(p->>'Mobile','') else mobile end,
    phone=case when p?'Phone' then nullif(p->>'Phone','') else phone end,
    telephone_no_1=case when p?'TelephoneNo1' then nullif(p->>'TelephoneNo1','') else telephone_no_1 end,
    telephone_no_2=case when p?'TelephoneNo2' then nullif(p->>'TelephoneNo2','') else telephone_no_2 end,
    notes=case when p?'Notes' then nullif(p->>'Notes','') else notes end,
    enrollment_date=case when v_dates then v_enrollment else enrollment_date end,
    membership_period=case when v_kind and v_links>0 and p?'MembershipDuration' then v_duration when p?'LegacyMembershipPeriod' then nullif(p->>'LegacyMembershipPeriod','') else membership_period end,
    status=v_status,updated_at=clock_timestamp()
    where id=m.id;
  insert into public.bgm_audit_log(system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data)
    values(p_staff_id,v_gym,'member.current_csv.update','member',m.id::text,m.id,p_edit->'before',
      jsonb_build_object('patch',p,'memberNumber',m.member_number,'sourceRow',p_edit->'rowNumber','batchId',p_edit->'batchId','previousExpiry',m.membership_expiry,'newExpiry',v_end,'newStatus',v_status));
  return jsonb_build_object('valid',true,'updated',true);
end;
$$;

create or replace function public.bgm_stage_current_csv_edits(p_batch_id uuid,p_staff_id uuid,p_edits jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.bgm_current_csv_batches%rowtype; e jsonb; problem text; n integer;
begin
  if not exists(select 1 from public.bgm_system_users where id=p_staff_id and active and is_super_admin)
  then raise exception 'Super Admin access required.'; end if;
  select * into b from public.bgm_current_csv_batches where id=p_batch_id and created_by=p_staff_id for update;
  if not found or b.status<>'preview' or b.created_at<now()-interval '24 hours' then raise exception 'CSV preview expired or unavailable.'; end if;
  if jsonb_typeof(p_edits)<>'array' or jsonb_array_length(p_edits)>100 then raise exception 'Invalid preview chunk.'; end if;
  select count(*) into n from public.bgm_current_csv_edits where batch_id=b.id;
  if n+jsonb_array_length(p_edits)>b.expected_edits then raise exception 'Unexpected number of edits in preview.'; end if;
  for e in select value from jsonb_array_elements(p_edits) loop
    problem:=null;
    begin
      perform public.bgm_validate_current_csv_edit(p_staff_id,e,false);
    exception when others then get stacked diagnostics problem=message_text;
    end;
    insert into public.bgm_current_csv_edits(batch_id,member_id,member_number,row_number,edit,issue)
      values(b.id,(e->>'memberId')::uuid,e->>'memberNumber',(e->>'rowNumber')::integer,e||jsonb_build_object('batchId',b.id),problem);
  end loop;
  return jsonb_build_object('staged',(select count(*) from public.bgm_current_csv_edits where batch_id=b.id),
    'issues',(select count(*) from public.bgm_current_csv_edits where batch_id=b.id and issue is not null));
end;
$$;

create or replace function public.bgm_apply_current_csv_batch(p_batch_id uuid,p_staff_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.bgm_current_csv_batches%rowtype; e public.bgm_current_csv_edits%rowtype; n integer;
begin
  if not exists(select 1 from public.bgm_system_users where id=p_staff_id and active and is_super_admin)
  then raise exception 'Super Admin access required.'; end if;
  perform pg_catalog.set_config('lock_timeout','3000',true);
  select * into b from public.bgm_current_csv_batches where id=p_batch_id and created_by=p_staff_id for update;
  if not found then raise exception 'CSV preview unavailable.'; end if;
  if b.status='applied' then return jsonb_build_object('applied',true,'updated',b.expected_edits,'alreadyApplied',true); end if;
  if b.created_at<now()-interval '24 hours' then raise exception 'CSV preview expired. Preview again.'; end if;
  select count(*) into n from public.bgm_current_csv_edits where batch_id=b.id;
  if n<>b.expected_edits or exists(select 1 from public.bgm_current_csv_edits where batch_id=b.id and issue is not null)
  then raise exception 'Preview incomplete or contains unresolved issues. Nothing applied.'; end if;
  for e in select * from public.bgm_current_csv_edits where batch_id=b.id order by member_id loop
    perform public.bgm_validate_current_csv_edit(p_staff_id,e.edit,true);
  end loop;
  update public.bgm_current_csv_batches set status='applied',applied_at=now() where id=b.id;
  return jsonb_build_object('applied',true,'updated',n,'alreadyApplied',false);
end;
$$;
revoke all on function public.bgm_validate_current_csv_edit(uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.bgm_stage_current_csv_edits(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.bgm_apply_current_csv_batch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bgm_validate_current_csv_edit(uuid,jsonb,boolean) to service_role;
grant execute on function public.bgm_stage_current_csv_edits(uuid,uuid,jsonb) to service_role;
grant execute on function public.bgm_apply_current_csv_batch(uuid,uuid) to service_role;
