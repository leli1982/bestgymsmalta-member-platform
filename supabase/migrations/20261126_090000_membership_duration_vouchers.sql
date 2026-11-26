-- Duration promotions, opt-in eligibility and immutable activation snapshots.
-- No campaign data is seeded and existing voucher rows retain their behaviour.
-- Effective activation functions derived from production at d67df3f21f792888f5a484fa00a4809e008a666b.
alter table public.bgm_discount_codes
  add column extension_months integer not null default 0,
  add column eligible_duration_keys text[],
  add column eligible_membership_types text[],
  add column eligible_application_kinds text[],
  add column eligible_gym_ids text[],
  drop constraint bgm_discount_codes_percentage_check,
  add constraint bgm_discount_codes_percentage_check check (percentage between 0 and 100),
  add constraint bgm_discount_codes_promotion_check check (
    extension_months between 0 and 120 and (percentage > 0 or extension_months > 0)
    and (extension_months = 0 or coalesce(reimbursement_value_cents,0) = 0)
    and (eligible_duration_keys is null or (cardinality(eligible_duration_keys)>0 and array_position(eligible_duration_keys,null) is null and eligible_duration_keys <@ array['1_session','1_week','2_weeks','1_month','3_months','6_months','1_year']::text[]))
    and (extension_months=0 or eligible_duration_keys is null or not ('1_session'=any(eligible_duration_keys)))
    and (eligible_membership_types is null or (cardinality(eligible_membership_types)>0 and array_position(eligible_membership_types,null) is null and eligible_membership_types <@ array['single','student','couples']::text[]))
    and (eligible_application_kinds is null or (cardinality(eligible_application_kinds)>0 and array_position(eligible_application_kinds,null) is null and eligible_application_kinds <@ array['new','renewal']::text[]))
    and (eligible_gym_ids is null or (cardinality(eligible_gym_ids)>0 and array_position(eligible_gym_ids,null) is null))
  );

alter table public.bgm_membership_applications
  add column voucher_extension_months_snapshot integer not null default 0,
  add column voucher_base_expiry_date_snapshot date,
  add column voucher_terms_snapshot jsonb,
  add constraint bgm_app_voucher_extension_snapshot_check check (
    voucher_extension_months_snapshot between 0 and 120
    and ((voucher_extension_months_snapshot=0 and voucher_base_expiry_date_snapshot is null)
      or (voucher_extension_months_snapshot>0 and voucher_base_expiry_date_snapshot is not null and voucher_terms_snapshot is not null))
  );
alter table public.bgm_memberships
  add column voucher_extension_months_snapshot integer not null default 0,
  add column voucher_base_expiry_date_snapshot date,
  add column voucher_terms_snapshot jsonb,
  add constraint bgm_membership_voucher_extension_snapshot_check check (
    voucher_extension_months_snapshot between 0 and 120
    and ((voucher_extension_months_snapshot=0 and voucher_base_expiry_date_snapshot is null)
      or (voucher_extension_months_snapshot>0 and voucher_base_expiry_date_snapshot is not null and voucher_terms_snapshot is not null))
  );

-- Match the existing JS UTC month rollover convention, including month ends.
create function public.bgm_add_voucher_months(p_date date,p_months integer)
returns date language sql immutable strict set search_path='' as $$
  select (pg_catalog.date_trunc('month',p_date::timestamp)
    + pg_catalog.make_interval(months=>p_months,days=>(extract(day from p_date)::integer-1)))::date;
$$;
create function public.bgm_voucher_has_advanced_terms(p_voucher public.bgm_discount_codes)
returns boolean language sql immutable strict set search_path='' as $$
  select p_voucher.extension_months>0 or p_voucher.eligible_duration_keys is not null
    or p_voucher.eligible_membership_types is not null or p_voucher.eligible_application_kinds is not null
    or p_voucher.eligible_gym_ids is not null;
$$;
create function public.bgm_voucher_is_eligible(p_voucher public.bgm_discount_codes,p_application public.bgm_membership_applications)
returns boolean language sql immutable strict set search_path='' as $$
  select (p_voucher.extension_months=0 or p_application.duration_key<>'1_session')
    and (p_voucher.eligible_duration_keys is null or p_application.duration_key=any(p_voucher.eligible_duration_keys))
    and (p_voucher.eligible_membership_types is null or p_application.membership_type=any(p_voucher.eligible_membership_types))
    and (p_voucher.eligible_application_kinds is null or p_application.application_kind=any(p_voucher.eligible_application_kinds))
    and (p_voucher.eligible_gym_ids is null or p_application.enrollment_gym_id=any(p_voucher.eligible_gym_ids));
$$;
CREATE OR REPLACE FUNCTION public.bgm_voucher_approval_terms(p_voucher bgm_discount_codes)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select pg_catalog.jsonb_build_object(
    'code',p_voucher.code,
    'percentage',p_voucher.percentage,
    'active',p_voucher.active,
    'validFrom',p_voucher.valid_from,
    'validUntil',p_voucher.valid_until,
    'maxUses',p_voucher.max_uses,
    'reimbursementCents',p_voucher.reimbursement_value_cents,
    'requiresVerification',p_voucher.requires_verification
  ) || case when public.bgm_voucher_has_advanced_terms(p_voucher) then pg_catalog.jsonb_build_object(
    'extensionMonths',p_voucher.extension_months,
    'eligibleDurationKeys',p_voucher.eligible_duration_keys,
    'eligibleMembershipTypes',p_voucher.eligible_membership_types,
    'eligibleApplicationKinds',p_voucher.eligible_application_kinds,
    'eligibleGymIds',p_voucher.eligible_gym_ids
  ) else '{}'::jsonb end;
$function$

create function public.bgm_membership_voucher_quote(p_voucher public.bgm_discount_codes,p_application public.bgm_membership_applications)
returns jsonb language sql stable strict set search_path='' as $$
  select pg_catalog.jsonb_build_object(
    'voucherTerms',public.bgm_voucher_approval_terms(p_voucher),
    'applicationId',p_application.id,'membershipType',p_application.membership_type,
    'durationKey',p_application.duration_key,'applicationKind',p_application.application_kind,
    'gymId',p_application.enrollment_gym_id,'startDate',p_application.start_date,
    'baseExpiryDate',p_application.expiry_date,'basePriceCents',p_application.base_price_cents,
    'priceCatalogVersionId',p_application.price_catalog_version_id,
    'accessScope',p_application.access_scope,'accessGymId',p_application.access_gym_id);
$$;
CREATE OR REPLACE FUNCTION public.bgm_activate_membership_application(p_application_id uuid, p_activation_staff_name text, p_system_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_participant public.bgm_membership_application_members%rowtype;
  v_system_user record;
  v_card public.bgm_member_card_credentials%rowtype;
  v_current_card public.bgm_member_card_credentials%rowtype;
  v_membership_id uuid;
  v_member_id uuid;
  v_member_number text;
  v_card_barcode text;
  v_existing_photo_path text;
  v_existing_status text;
  v_existing_expiry date;
  v_member_count integer;
  v_expected_count integer;
  v_primary_member_id uuid;
  v_affected_members jsonb := '[]'::jsonb;
  v_discount public.bgm_discount_codes%rowtype;
  v_discount_amount integer := 0;
  v_final_amount integer;
  v_today date := (now() at time zone 'Europe/Malta')::date;
begin
  if p_application_id is null then raise exception 'Membership application is required.'; end if;
  if nullif(btrim(coalesce(p_activation_staff_name,'')), '') is null then raise exception 'Activation Staff Name is required.'; end if;
  if p_system_user_id is null then raise exception 'Activating system user is required.'; end if;
  select id,gym_id,is_super_admin,active into v_system_user from public.bgm_system_users where id=p_system_user_id and active=true;
  if not found then raise exception 'Activating system user is not active.'; end if;
  select * into v_application from public.bgm_membership_applications where id=p_application_id for update;
  if not found then raise exception 'Membership application was not found.'; end if;

  if v_application.status='activated' then
    select ms.id into v_membership_id from public.bgm_memberships ms where ms.application_id=p_application_id order by ms.created_at desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('memberId',m.id,'memberNumber',m.member_number,'cardBarcode',c.barcode_value,'role',mm.member_role) order by case mm.member_role when 'primary' then 1 else 2 end),'[]'::jsonb) into v_affected_members from public.bgm_membership_members mm join public.bgm_members m on m.id=mm.member_id left join public.bgm_member_card_credentials c on c.member_id=m.id and c.status='active' where mm.membership_id=v_membership_id;
    return jsonb_build_object('applicationId',p_application_id,'membershipId',v_membership_id,'applicationKind',v_application.application_kind,'members',v_affected_members,'idempotent',true,'expiryDate',v_application.expiry_date,'voucherExtensionMonths',v_application.voucher_extension_months_snapshot);
  end if;

  if v_application.status not in ('submitted','awaiting_payment') then raise exception 'Membership application is not awaiting activation.'; end if;
  if not v_system_user.is_super_admin and v_system_user.gym_id is distinct from v_application.enrollment_gym_id then raise exception 'This application belongs to another gym.'; end if;
  if v_application.start_date is null or v_application.expiry_date is null then raise exception 'Membership start date and expiry date are required before activation.'; end if;
  if v_application.expiry_date < v_application.start_date then raise exception 'Membership expiry date cannot be before the start date.'; end if;
  if v_application.base_price_cents is null then raise exception 'Application base price snapshot is required before activation.'; end if;
  if v_application.payment_method is null or v_application.payment_method not in ('cash','card','other') then raise exception 'A valid payment method is required before activation.'; end if;
  if v_application.payment_method='other' and nullif(btrim(coalesce(v_application.payment_other_text,'')), '') is null then raise exception 'Other payment description is required before activation.'; end if;
  if nullif(btrim(coalesce(v_application.payment_staff_name,'')), '') is null then raise exception 'Payment Staff Name is required before activation.'; end if;
  if v_application.payment_system_user_id is null then raise exception 'Payment system user is required before activation.'; end if;

  select count(*) into v_member_count from public.bgm_membership_application_members where application_id=p_application_id;
  v_expected_count := case when v_application.membership_type='couples' then 2 else 1 end;
  if v_member_count <> v_expected_count then raise exception 'Membership application has an invalid participant count.'; end if;
  if v_application.membership_type='couples' and v_application.same_address_verified_at is null then raise exception 'Same-address verification is required before activation.'; end if;

  for v_participant in select * from public.bgm_membership_application_members where application_id=p_application_id order by participant_order for update loop
    if v_participant.id_verified_at is null then raise exception 'ID / passport verification is required before activation.'; end if;
    if v_application.membership_type='student' and v_participant.student_eligibility_verified_at is null then raise exception 'Student eligibility verification is required before activation.'; end if;
    if v_participant.under_18_at_submission then
      if v_participant.guardian_present_verified_at is null then raise exception 'Guardian presence verification is required before activation.'; end if;
      if v_participant.guardian_cosign_verified_at is null then raise exception 'Guardian co-sign verification is required before activation.'; end if;
    end if;

    if v_participant.existing_member_id is not null then
      select id,member_number,official_photo_path,status,membership_expiry into v_member_id,v_member_number,v_existing_photo_path,v_existing_status,v_existing_expiry from public.bgm_members where id=v_participant.existing_member_id for update;
      if not found then raise exception 'Existing renewal member was not found.'; end if;
      if lower(coalesce(v_existing_status,''))='active' and (v_existing_expiry is null or v_existing_expiry >= v_today) and v_participant.identity_match_state='expired_inactive' then raise exception 'Existing matched member is active and must be reviewed again.'; end if;
      if v_participant.renewal_card_action not in ('keep','replace') or nullif(btrim(coalesce(v_participant.renewal_scanned_barcode,'')), '') is null or v_participant.renewal_card_verified_at is null then raise exception 'Renewal membership card must be scanned and verified before activation.'; end if;
      select * into v_current_card from public.bgm_member_card_credentials where member_id=v_participant.existing_member_id and status='active' for update;
      if v_participant.renewal_card_action='keep' then
        if found then
          if v_current_card.barcode_value <> v_participant.renewal_scanned_barcode then raise exception 'Verified renewal card no longer matches the active member card.'; end if;
        else
          if exists(select 1 from public.bgm_member_card_credentials where barcode_value=v_participant.renewal_scanned_barcode) then raise exception 'Verified renewal card is already registered to another credential.'; end if;
        end if;
      else
        select * into v_card from public.bgm_member_card_credentials where application_member_id=v_participant.id and status='reserved' and barcode_value=v_participant.renewal_scanned_barcode for update;
        if not found then raise exception 'Reserved renewal replacement card is required before activation.'; end if;
      end if;
    else
      select * into v_card from public.bgm_member_card_credentials where application_member_id=v_participant.id and status='reserved' for update;
      if not found then raise exception 'Reserved membership card is required before activation.'; end if;
    end if;
  end loop;

  if v_application.discount_code_id is not null then
    select * into v_discount from public.bgm_discount_codes where id=v_application.discount_code_id for update;
    if not found or not v_discount.active or (v_discount.valid_from is not null and v_today<v_discount.valid_from) or (v_discount.valid_until is not null and v_today>v_discount.valid_until) or (v_discount.max_uses is not null and v_discount.successful_uses>=v_discount.max_uses) then raise exception 'Discount code is unavailable.'; end if;
    if not public.bgm_voucher_is_eligible(v_discount,v_application) then
      raise exception 'Discount code is not eligible for this membership.';
    end if;
    if public.bgm_voucher_has_advanced_terms(v_discount) then
      if v_application.voucher_terms_snapshot is distinct from public.bgm_voucher_approval_terms(v_discount)
         or v_application.voucher_extension_months_snapshot <> 0
         or v_application.voucher_base_expiry_date_snapshot is not null then
        raise exception 'Discount code terms changed or were not confirmed. Apply the voucher again.';
      end if;
    elsif v_application.voucher_terms_snapshot is not null then
      raise exception 'Discount code terms changed. Apply the voucher again.';
    end if;
    v_discount_amount := round(v_application.base_price_cents * v_discount.percentage / 100.0)::integer;
    v_final_amount := greatest(v_application.base_price_cents-v_discount_amount,0);
    if v_application.discount_code_snapshot is distinct from v_discount.code or v_application.discount_percentage_snapshot is distinct from v_discount.percentage or v_application.discount_amount_cents is distinct from v_discount_amount or v_application.final_amount_cents is distinct from v_final_amount then raise exception 'Discount snapshot is no longer valid.'; end if;
  else
    v_discount_amount := 0;
    v_final_amount := v_application.base_price_cents;
    if coalesce(v_application.discount_amount_cents,0)<>0 or coalesce(v_application.final_amount_cents,v_application.base_price_cents)<>v_application.base_price_cents then raise exception 'Application price snapshot is invalid.'; end if;
  end if;

  -- Persist the promotion and expiry before the normal member/card writes.
  -- The existing activated-status early return makes retries idempotent.
  if v_application.discount_code_id is not null and v_discount.extension_months > 0 then
    update public.bgm_membership_applications
       set voucher_extension_months_snapshot=v_discount.extension_months,
           voucher_base_expiry_date_snapshot=v_application.expiry_date,
           expiry_date=public.bgm_add_voucher_months(v_application.expiry_date,v_discount.extension_months)
     where id=v_application.id returning * into v_application;
  end if;
  insert into public.bgm_memberships(application_id,membership_type,duration_key,start_date,expiry_date,enrollment_gym_id,status,activation_staff_name,activated_by_system_user_id,updated_at,voucher_extension_months_snapshot,voucher_base_expiry_date_snapshot,voucher_terms_snapshot) values(v_application.id,v_application.membership_type,v_application.duration_key,v_application.start_date,v_application.expiry_date,v_application.enrollment_gym_id,'active',btrim(p_activation_staff_name),p_system_user_id,now(),v_application.voucher_extension_months_snapshot,v_application.voucher_base_expiry_date_snapshot,v_application.voucher_terms_snapshot) returning id into v_membership_id;

  for v_participant in select * from public.bgm_membership_application_members where application_id=p_application_id order by participant_order for update loop
    if v_participant.existing_member_id is null then
      select * into v_card from public.bgm_member_card_credentials where application_member_id=v_participant.id and status='reserved' for update;
      -- Reuse the number previously printed and reserved for this application.
      -- Older/unprinted applications still allocate at activation as before.
      v_member_number := coalesce(v_participant.reserved_member_number, public.bgm_next_member_number());
      v_card_barcode := v_card.barcode_value;
      insert into public.bgm_members(member_number,full_name,first_name,last_name,email,phone,status,enrollment_date,membership_period,membership_expiry,address_line_1,address_line_2,town,postcode,id_number,date_of_birth,next_of_kin,enrollment_gym_id,official_photo_path,updated_at) values(v_member_number,btrim(v_participant.first_name||' '||v_participant.last_name),btrim(v_participant.first_name),btrim(v_participant.last_name),nullif(lower(btrim(v_participant.email)),''),nullif(btrim(v_participant.phone),''),'active',v_application.start_date,v_application.duration_key,v_application.expiry_date,nullif(btrim(v_participant.address_line_1),''),nullif(btrim(v_participant.address_line_2),''),nullif(btrim(v_participant.town),''),nullif(btrim(v_participant.postcode),''),nullif(btrim(v_participant.id_number),''),v_participant.date_of_birth,nullif(btrim(v_participant.next_of_kin),''),v_application.enrollment_gym_id,nullif(btrim(v_participant.official_photo_path),''),now()) returning id into v_member_id;
      update public.bgm_member_card_credentials set member_id=v_member_id,application_member_id=null,status='active',activated_at=now(),updated_at=now() where id=v_card.id and status='reserved';
      if not found then raise exception 'Reserved membership card could not be activated.'; end if;
      update public.bgm_member_official_photos set member_id=v_member_id,application_member_id=null where application_member_id=v_participant.id;
    else
      select id,member_number,official_photo_path into v_member_id,v_member_number,v_existing_photo_path from public.bgm_members where id=v_participant.existing_member_id for update;
      select * into v_current_card from public.bgm_member_card_credentials where member_id=v_member_id and status='active' for update;
      if v_participant.renewal_card_action='keep' then
        v_card_barcode := v_participant.renewal_scanned_barcode;
        if not found then insert into public.bgm_member_card_credentials(barcode_value,member_id,application_member_id,status,reserved_at,activated_at,created_by_system_user_id,updated_at) values(v_card_barcode,v_member_id,null,'active',now(),now(),p_system_user_id,now()); end if;
      else
        select * into v_card from public.bgm_member_card_credentials where application_member_id=v_participant.id and status='reserved' and barcode_value=v_participant.renewal_scanned_barcode for update;
        v_card_barcode := v_card.barcode_value;
        if v_current_card.id is not null then update public.bgm_member_card_credentials set status='retired',retired_at=now(),retired_reason='renewal_replacement',updated_at=now() where id=v_current_card.id and status='active'; end if;
        update public.bgm_member_card_credentials set member_id=v_member_id,application_member_id=null,status='active',activated_at=now(),updated_at=now() where id=v_card.id and status='reserved';
        if not found then raise exception 'Reserved renewal replacement card could not be activated.'; end if;
      end if;
      update public.bgm_members set first_name=btrim(v_participant.first_name),last_name=btrim(v_participant.last_name),full_name=btrim(v_participant.first_name||' '||v_participant.last_name),email=coalesce(nullif(lower(btrim(v_participant.email)),''),email),phone=coalesce(nullif(btrim(v_participant.phone),''),phone),address_line_1=coalesce(nullif(btrim(v_participant.address_line_1),''),address_line_1),address_line_2=coalesce(nullif(btrim(v_participant.address_line_2),''),address_line_2),town=coalesce(nullif(btrim(v_participant.town),''),town),postcode=coalesce(nullif(btrim(v_participant.postcode),''),postcode),id_number=coalesce(nullif(btrim(v_participant.id_number),''),id_number),date_of_birth=coalesce(v_participant.date_of_birth,date_of_birth),next_of_kin=coalesce(nullif(btrim(v_participant.next_of_kin),''),next_of_kin),official_photo_path=coalesce(nullif(btrim(v_participant.official_photo_path),''),official_photo_path),status='active',enrollment_date=v_application.start_date,membership_period=v_application.duration_key,membership_expiry=v_application.expiry_date,enrollment_gym_id=v_application.enrollment_gym_id,updated_at=now() where id=v_member_id;
      update public.bgm_member_official_photos set member_id=v_member_id,application_member_id=null where application_member_id=v_participant.id;
    end if;
    insert into public.bgm_membership_members(membership_id,member_id,member_role) values(v_membership_id,v_member_id,case when v_participant.participant_order=1 then 'primary' else 'partner' end);
    if v_participant.participant_order=1 then v_primary_member_id:=v_member_id; end if;
    v_affected_members := v_affected_members || jsonb_build_array(jsonb_build_object('memberId',v_member_id,'memberNumber',v_member_number,'cardBarcode',v_card_barcode,'role',case when v_participant.participant_order=1 then 'primary' else 'partner' end));
  end loop;

  if v_application.discount_code_id is not null then update public.bgm_discount_codes set successful_uses=successful_uses+1,updated_at=now() where id=v_application.discount_code_id; end if;
  update public.bgm_membership_applications set discount_amount_cents=v_discount_amount,final_amount_cents=v_final_amount,status='activated',reviewed_by_system_user_id=p_system_user_id,payment_received_at=now(),activated_at=now(),updated_at=now() where id=v_application.id;
  insert into public.bgm_audit_log(system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,member_id,before_data,after_data) values(p_system_user_id,v_application.enrollment_gym_id,btrim(p_activation_staff_name),'membership.activate','membership_application',v_application.id::text,v_primary_member_id,jsonb_build_object('status',v_application.status,'applicationKind',v_application.application_kind,'basePriceCents',v_application.base_price_cents),jsonb_build_object('status','activated','applicationKind',v_application.application_kind,'membershipId',v_membership_id,'basePriceCents',v_application.base_price_cents,'discountAmountCents',v_discount_amount,'finalAmountCents',v_final_amount,'paymentMethod',v_application.payment_method,'members',v_affected_members,'voucherExtensionMonths',v_application.voucher_extension_months_snapshot,'voucherBaseExpiryDate',v_application.voucher_base_expiry_date_snapshot,'expiryDate',v_application.expiry_date,'voucherTerms',v_application.voucher_terms_snapshot));
  return jsonb_build_object('applicationId',v_application.id,'membershipId',v_membership_id,'applicationKind',v_application.application_kind,'members',v_affected_members,'idempotent',false,'expiryDate',v_application.expiry_date,'voucherExtensionMonths',v_application.voucher_extension_months_snapshot);
end;
$function$

CREATE OR REPLACE FUNCTION public.bgm_request_voucher_approval(p_application_id uuid, p_voucher_code text, p_system_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_voucher public.bgm_discount_codes%rowtype;
  v_actor public.bgm_system_users%rowtype;
  v_existing public.bgm_voucher_approval_requests%rowtype;
  v_new public.bgm_voucher_approval_requests%rowtype;
  v_terms jsonb;
  v_today date := (now() at time zone 'Europe/Malta')::date;
begin
  select * into v_actor from public.bgm_system_users where id=p_system_user_id and active=true;
  if not found then raise exception 'Active Staff or Super Admin login is required.'; end if;

  -- Always lock application first: activation, request and decision all serialize on it.
  select * into v_application from public.bgm_membership_applications
    where id=p_application_id for update;
  if not found or v_application.status not in ('submitted','awaiting_payment') then
    raise exception 'Membership application is not awaiting payment.';
  end if;
  if not (v_actor.is_super_admin or v_actor.role='super_admin')
     and v_actor.gym_id is distinct from v_application.enrollment_gym_id then
    raise exception 'This application belongs to another gym.';
  end if;

  select * into v_voucher from public.bgm_discount_codes
    where upper(btrim(code))=upper(btrim(coalesce(p_voucher_code,''))) for update;
  if not found or not v_voucher.requires_verification then
    raise exception 'This voucher does not require approval.';
  end if;
  if not v_voucher.active
     or (v_voucher.valid_from is not null and v_today<v_voucher.valid_from)
     or (v_voucher.valid_until is not null and v_today>v_voucher.valid_until)
     or (v_voucher.max_uses is not null and v_voucher.successful_uses>=v_voucher.max_uses) then
    raise exception 'Discount code is unavailable.';
  end if;
  if not public.bgm_voucher_is_eligible(v_voucher,v_application) then
    raise exception 'Discount code is not eligible for this membership.';
  end if;
  v_terms := public.bgm_voucher_approval_terms(v_voucher);

  -- A changed voucher, settings change, or new application needs its own decision.
  update public.bgm_voucher_approval_requests
    set status='cancelled',updated_at=now()
    where application_id=p_application_id and status in ('pending','approved')
      and (voucher_id<>v_voucher.id or voucher_terms<>v_terms);

  select * into v_existing from public.bgm_voucher_approval_requests
    where application_id=p_application_id and voucher_id=v_voucher.id
      and voucher_terms=v_terms and status in ('pending','approved')
    for update;
  if found then
    return pg_catalog.jsonb_build_object(
      'id',v_existing.id,'status',v_existing.status,'created',false);
  end if;

  insert into public.bgm_voucher_approval_requests (
    application_id,voucher_id,voucher_code,voucher_terms,gym_id,requested_by_system_user_id
  ) values (
    p_application_id,v_voucher.id,v_voucher.code,v_terms,v_application.enrollment_gym_id,p_system_user_id
  ) returning * into v_new;

  insert into public.bgm_audit_log (
    system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,after_data
  ) values (
    p_system_user_id,v_application.enrollment_gym_id,v_actor.display_name,
    'voucher.approval.requested','membership_application',p_application_id::text,
    pg_catalog.jsonb_build_object('requestId',v_new.id,'voucherCode',v_voucher.code,'status','pending')
  );

  return pg_catalog.jsonb_build_object('id',v_new.id,'status','pending','created',true);
end;
$function$

CREATE OR REPLACE FUNCTION public.bgm_super_admin_apply_member_voucher(p_system_user_id uuid, p_member_id uuid, p_membership_id uuid, p_expected_application_updated_at timestamp with time zone, p_voucher_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.bgm_members%rowtype;
  v_membership public.bgm_memberships%rowtype;
  v_application public.bgm_membership_applications%rowtype;
  v_discount public.bgm_discount_codes%rowtype;
  v_code text := upper(btrim(coalesce(p_voucher_code, '')));
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_new_discount integer;
  v_new_final integer;
  v_refund integer;
  v_participant_count integer;
  v_alert_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if not exists (
    select 1 from public.bgm_system_users
    where id = p_system_user_id and active = true and is_super_admin = true
  ) then
    raise exception 'Super Admin access required.';
  end if;

  if v_code = '' then raise exception 'Choose a voucher to apply.'; end if;
  if p_expected_application_updated_at is null then
    raise exception 'Reload this member before changing the voucher.';
  end if;

  select * into v_member
  from public.bgm_members
  where id = p_member_id
  for update;
  if not found then raise exception 'Member not found.'; end if;

  select * into v_membership
  from public.bgm_memberships
  where id = p_membership_id
  for update;
  if not found then raise exception 'Membership not found.'; end if;

  if not exists (
    select 1 from public.bgm_membership_members
    where membership_id = p_membership_id and member_id = p_member_id
  ) then
    raise exception 'This membership does not belong to this member.';
  end if;

  select count(*) into v_participant_count
  from public.bgm_membership_members
  where membership_id = p_membership_id;
  if v_participant_count <> 1 then
    raise exception 'Shared memberships require joint voucher correction.';
  end if;

  if v_membership.application_id is null then
    raise exception 'This membership has no linked payment application.';
  end if;

  select * into v_application
  from public.bgm_membership_applications
  where id = v_membership.application_id
  for update;
  if not found then raise exception 'Linked payment application was not found.'; end if;

  if v_application.status <> 'activated' then
    raise exception 'Only an activated membership payment can be corrected.';
  end if;
  if v_application.updated_at is distinct from p_expected_application_updated_at then
    raise exception 'This payment changed since you opened the editor. Reload before saving.';
  end if;
  if v_application.base_price_cents is null or v_application.final_amount_cents is null then
    raise exception 'This payment does not have a complete price snapshot.';
  end if;
  if v_application.payment_received_at is null then
    raise exception 'This membership does not have a recorded payment receipt.';
  end if;
  if upper(btrim(coalesce(v_application.discount_code_snapshot, ''))) = v_code then
    return jsonb_build_object('changed', false, 'refundDueCents', 0, 'alertId', null);
  end if;

  select * into v_discount
  from public.bgm_discount_codes
  where upper(btrim(code)) = v_code
  for update;
  if not found
    or not v_discount.active
    or (v_discount.valid_from is not null and v_today < v_discount.valid_from)
    or (v_discount.valid_until is not null and v_today > v_discount.valid_until)
    or (v_discount.max_uses is not null and v_discount.successful_uses >= v_discount.max_uses) then
    raise exception 'Voucher is unavailable.';
  end if;

  if public.bgm_voucher_has_advanced_terms(v_discount) or v_application.voucher_terms_snapshot is not null then
    raise exception 'Voucher is unavailable for historical correction of promotional or restricted vouchers.';
  end if;
  v_new_discount := round(v_application.base_price_cents * v_discount.percentage / 100.0)::integer;
  v_new_final := greatest(v_application.base_price_cents - v_new_discount, 0);
  v_refund := v_application.final_amount_cents - v_new_final;

  if v_refund <= 0 then
    raise exception 'This voucher would not create a refund. Use the dedicated payment correction flow instead.';
  end if;

  v_before := jsonb_build_object(
    'discountCode', v_application.discount_code_snapshot,
    'discountPercentage', v_application.discount_percentage_snapshot,
    'discountAmountCents', v_application.discount_amount_cents,
    'finalAmountCents', v_application.final_amount_cents
  );

  if v_application.discount_code_snapshot is not null then
    update public.bgm_discount_codes
    set successful_uses = greatest(successful_uses - 1, 0),
        updated_at = clock_timestamp()
    where upper(btrim(code)) = upper(btrim(v_application.discount_code_snapshot));
  end if;

  update public.bgm_discount_codes
  set successful_uses = successful_uses + 1,
      updated_at = clock_timestamp()
  where id = v_discount.id;

  update public.bgm_membership_applications
  set discount_code_id = v_discount.id,
      discount_code_snapshot = v_discount.code,
      discount_percentage_snapshot = v_discount.percentage,
      discount_amount_cents = v_new_discount,
      final_amount_cents = v_new_final,
      updated_at = clock_timestamp()
  where id = v_application.id
  returning * into v_application;

  insert into public.bgm_member_refund_alerts (
    member_id, membership_id, application_id, voucher_code, voucher_percentage,
    original_final_amount_cents, corrected_final_amount_cents, refund_due_cents,
    currency, member_first_name, member_last_name, member_id_number, member_mobile,
    created_by_system_user_id
  ) values (
    v_member.id, v_membership.id, v_application.id, v_discount.code, v_discount.percentage,
    (v_new_final + v_refund), v_new_final, v_refund,
    coalesce(v_application.currency, 'EUR'), v_member.first_name, v_member.last_name,
    v_member.id_number, coalesce(v_member.mobile, v_member.phone),
    p_system_user_id
  )
  returning id into v_alert_id;

  v_after := jsonb_build_object(
    'discountCode', v_application.discount_code_snapshot,
    'discountPercentage', v_application.discount_percentage_snapshot,
    'discountAmountCents', v_application.discount_amount_cents,
    'finalAmountCents', v_application.final_amount_cents,
    'refundDueCents', v_refund,
    'refundAlertId', v_alert_id
  );

  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, action_key, entity_type, entity_id, member_id,
    before_data, after_data
  ) values (
    p_system_user_id, v_member.enrollment_gym_id,
    'member.voucher.retroactive_applied', 'membership_application',
    v_application.id::text, v_member.id, v_before, v_after
  );

  return jsonb_build_object(
    'changed', true,
    'alertId', v_alert_id,
    'refundDueCents', v_refund,
    'voucherCode', v_discount.code,
    'voucherPercentage', v_discount.percentage,
    'finalAmountCents', v_new_final,
    'applicationUpdatedAt', v_application.updated_at
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.bgm_super_admin_apply_legacy_member_voucher(p_system_user_id uuid, p_member_id uuid, p_expected_member_updated_at timestamp with time zone, p_voucher_code text, p_original_paid_cents integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.bgm_members%rowtype;
  v_discount public.bgm_discount_codes%rowtype;
  v_code text := upper(btrim(coalesce(p_voucher_code, '')));
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_refund integer;
  v_corrected integer;
  v_correction_id uuid;
  v_alert_id uuid;
begin
  if not exists (
    select 1 from public.bgm_system_users
    where id = p_system_user_id and active = true and is_super_admin = true
  ) then
    raise exception 'Super Admin access required.';
  end if;

  if v_code = '' then raise exception 'Choose a voucher to apply.'; end if;
  if p_expected_member_updated_at is null then
    raise exception 'Reload this member before changing the voucher.';
  end if;
  if p_original_paid_cents is null or p_original_paid_cents <= 0 or p_original_paid_cents > 10000000 then
    raise exception 'Enter the confirmed original amount paid.';
  end if;

  select * into v_member
  from public.bgm_members
  where id = p_member_id
  for update;
  if not found then raise exception 'Member not found.'; end if;

  if v_member.updated_at is distinct from p_expected_member_updated_at then
    raise exception 'This member changed since you opened the editor. Reload before saving.';
  end if;
  if v_member.status <> 'active' then
    raise exception 'Only a current active legacy member can receive this correction.';
  end if;

  if exists (
    select 1
    from public.bgm_membership_members mm
    join public.bgm_memberships ms on ms.id = mm.membership_id
    where mm.member_id = p_member_id and ms.status = 'active'
  ) then
    raise exception 'This member has an active transaction-backed membership. Use the recorded payment correction instead.';
  end if;

  if exists (
    select 1
    from public.bgm_legacy_member_voucher_corrections c
    where c.member_id = p_member_id
      and coalesce(c.membership_expiry_snapshot, date '0001-01-01')
          = coalesce(v_member.membership_expiry, date '0001-01-01')
  ) then
    raise exception 'A voucher correction is already recorded for this current legacy membership.';
  end if;

  select * into v_discount
  from public.bgm_discount_codes
  where upper(btrim(code)) = v_code
  for update;

  if not found
    or not v_discount.active
    or (v_discount.valid_from is not null and v_today < v_discount.valid_from)
    or (v_discount.valid_until is not null and v_today > v_discount.valid_until)
    or (v_discount.max_uses is not null and v_discount.successful_uses >= v_discount.max_uses)
  then
    raise exception 'Voucher is unavailable.';
  end if;

  if public.bgm_voucher_has_advanced_terms(v_discount) then
    raise exception 'Voucher is unavailable for historical correction of promotional or restricted vouchers.';
  end if;
  v_refund := round(p_original_paid_cents * v_discount.percentage / 100.0)::integer;
  v_corrected := greatest(p_original_paid_cents - v_refund, 0);
  if v_refund <= 0 then raise exception 'This voucher would not create a refund.'; end if;

  update public.bgm_discount_codes
  set successful_uses = successful_uses + 1,
      updated_at = clock_timestamp()
  where id = v_discount.id;

  insert into public.bgm_legacy_member_voucher_corrections (
    member_id, voucher_code_id, voucher_code, voucher_percentage,
    confirmed_original_paid_cents, corrected_final_amount_cents, refund_due_cents,
    currency, membership_expiry_snapshot, member_enrollment_date_snapshot,
    enrollment_gym_id_snapshot, member_first_name, member_last_name,
    member_id_number, member_mobile, created_by_system_user_id
  ) values (
    v_member.id, v_discount.id, v_discount.code, v_discount.percentage,
    p_original_paid_cents, v_corrected, v_refund,
    'EUR', v_member.membership_expiry, v_member.enrollment_date,
    v_member.enrollment_gym_id, v_member.first_name, v_member.last_name,
    v_member.id_number, coalesce(v_member.mobile, v_member.phone), p_system_user_id
  )
  returning id into v_correction_id;

  insert into public.bgm_member_refund_alerts (
    member_id, membership_id, application_id, legacy_correction_id,
    voucher_code, voucher_percentage, original_final_amount_cents,
    corrected_final_amount_cents, refund_due_cents, currency,
    member_first_name, member_last_name, member_id_number, member_mobile,
    created_by_system_user_id
  ) values (
    v_member.id, null, null, v_correction_id,
    v_discount.code, v_discount.percentage, p_original_paid_cents,
    v_corrected, v_refund, 'EUR',
    v_member.first_name, v_member.last_name, v_member.id_number,
    coalesce(v_member.mobile, v_member.phone), p_system_user_id
  )
  returning id into v_alert_id;

  insert into public.bgm_audit_log (
    system_user_id, context_gym_id, action_key, entity_type, entity_id, member_id,
    before_data, after_data
  ) values (
    p_system_user_id, v_member.enrollment_gym_id,
    'member.voucher.legacy_retroactive_applied', 'legacy_member_voucher_correction',
    v_correction_id::text, v_member.id,
    jsonb_build_object(
      'membershipExpiry', v_member.membership_expiry,
      'confirmedOriginalPaidCents', p_original_paid_cents
    ),
    jsonb_build_object(
      'voucherCode', v_discount.code,
      'voucherPercentage', v_discount.percentage,
      'correctedFinalAmountCents', v_corrected,
      'refundDueCents', v_refund,
      'refundAlertId', v_alert_id
    )
  );

  return jsonb_build_object(
    'changed', true,
    'legacyCorrectionId', v_correction_id,
    'alertId', v_alert_id,
    'refundDueCents', v_refund,
    'voucherCode', v_discount.code,
    'voucherPercentage', v_discount.percentage,
    'finalAmountCents', v_corrected
  );
end;
$function$

-- New client confirms the exact preview while the app and voucher are locked.
-- Old clients still use the unchanged six-argument RPC; advanced terms require
-- a snapshot created in this transaction, so stale old clients cannot grant them.
create function public.bgm_activate_membership_with_voucher_quote(
  p_application_id uuid,p_payment_method text,p_payment_other_text text,
  p_payment_staff_name text,p_discount_code text,p_system_user_id uuid,p_voucher_quote jsonb
) returns jsonb language plpgsql set search_path='' as $$
declare
  v_application public.bgm_membership_applications%rowtype;
  v_voucher public.bgm_discount_codes%rowtype;
  v_user record;
  v_today date := (now() at time zone 'Europe/Malta')::date;
begin
  select id,gym_id,is_super_admin into v_user from public.bgm_system_users
    where id=p_system_user_id and active=true;
  if not found then raise exception 'Activating system user is not active.'; end if;
  select * into v_application from public.bgm_membership_applications where id=p_application_id for update;
  if not found then raise exception 'Membership application was not found.'; end if;
  if not v_user.is_super_admin and v_user.gym_id is distinct from v_application.enrollment_gym_id then
    raise exception 'This application belongs to another gym.';
  end if;
  if v_application.status='activated' then
    return public.bgm_activate_membership_application(p_application_id,p_payment_method,p_payment_other_text,p_payment_staff_name,p_discount_code,p_system_user_id);
  end if;
  if v_application.status not in ('submitted','awaiting_payment') then
    raise exception 'Membership application is not awaiting activation.';
  end if;
  select * into v_voucher from public.bgm_discount_codes
    where upper(btrim(code))=upper(btrim(coalesce(p_discount_code,''))) for update;
  if not found or not v_voucher.active
     or (v_voucher.valid_from is not null and v_today<v_voucher.valid_from)
     or (v_voucher.valid_until is not null and v_today>v_voucher.valid_until)
     or (v_voucher.max_uses is not null and v_voucher.successful_uses>=v_voucher.max_uses) then
    raise exception 'Discount code is unavailable.';
  end if;
  if not public.bgm_voucher_is_eligible(v_voucher,v_application) then
    raise exception 'Discount code is not eligible for this membership.';
  end if;
  if p_voucher_quote is distinct from public.bgm_membership_voucher_quote(v_voucher,v_application) then
    raise exception 'Discount code terms or membership details changed. Apply the voucher again.';
  end if;
  if public.bgm_voucher_has_advanced_terms(v_voucher) then
    update public.bgm_membership_applications set voucher_terms_snapshot=public.bgm_voucher_approval_terms(v_voucher)
      where id=p_application_id;
  end if;
  return public.bgm_activate_membership_application(p_application_id,p_payment_method,p_payment_other_text,p_payment_staff_name,p_discount_code,p_system_user_id);
end;
$$;
revoke all on function public.bgm_add_voucher_months(date,integer) from public,anon,authenticated;
revoke all on function public.bgm_voucher_has_advanced_terms(public.bgm_discount_codes) from public,anon,authenticated;
revoke all on function public.bgm_voucher_is_eligible(public.bgm_discount_codes,public.bgm_membership_applications) from public,anon,authenticated;
revoke all on function public.bgm_membership_voucher_quote(public.bgm_discount_codes,public.bgm_membership_applications) from public,anon,authenticated;
revoke all on function public.bgm_activate_membership_with_voucher_quote(uuid,text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.bgm_add_voucher_months(date,integer),public.bgm_voucher_has_advanced_terms(public.bgm_discount_codes),public.bgm_voucher_is_eligible(public.bgm_discount_codes,public.bgm_membership_applications),public.bgm_membership_voucher_quote(public.bgm_discount_codes,public.bgm_membership_applications),public.bgm_activate_membership_with_voucher_quote(uuid,text,text,text,text,uuid,jsonb) to service_role;
