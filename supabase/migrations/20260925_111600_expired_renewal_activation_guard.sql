-- Only current active memberships block a renewal classified as expired/inactive.
-- An active status with membership_expiry before Malta's current date is expired.
-- Preserve the existing active-identity guard, row locks, audit and transaction logic.
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
    return jsonb_build_object('applicationId',p_application_id,'membershipId',v_membership_id,'applicationKind',v_application.application_kind,'members',v_affected_members,'idempotent',true);
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
    v_discount_amount := round(v_application.base_price_cents * v_discount.percentage / 100.0)::integer;
    v_final_amount := greatest(v_application.base_price_cents-v_discount_amount,0);
    if v_application.discount_code_snapshot is distinct from v_discount.code or v_application.discount_percentage_snapshot is distinct from v_discount.percentage or v_application.discount_amount_cents is distinct from v_discount_amount or v_application.final_amount_cents is distinct from v_final_amount then raise exception 'Discount snapshot is no longer valid.'; end if;
  else
    v_discount_amount := 0;
    v_final_amount := v_application.base_price_cents;
    if coalesce(v_application.discount_amount_cents,0)<>0 or coalesce(v_application.final_amount_cents,v_application.base_price_cents)<>v_application.base_price_cents then raise exception 'Application price snapshot is invalid.'; end if;
  end if;

  insert into public.bgm_memberships(application_id,membership_type,duration_key,start_date,expiry_date,enrollment_gym_id,status,activation_staff_name,activated_by_system_user_id,updated_at) values(v_application.id,v_application.membership_type,v_application.duration_key,v_application.start_date,v_application.expiry_date,v_application.enrollment_gym_id,'active',btrim(p_activation_staff_name),p_system_user_id,now()) returning id into v_membership_id;

  for v_participant in select * from public.bgm_membership_application_members where application_id=p_application_id order by participant_order for update loop
    if v_participant.existing_member_id is null then
      select * into v_card from public.bgm_member_card_credentials where application_member_id=v_participant.id and status='reserved' for update;
      v_member_number := public.bgm_next_member_number();
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
  insert into public.bgm_audit_log(system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,member_id,before_data,after_data) values(p_system_user_id,v_application.enrollment_gym_id,btrim(p_activation_staff_name),'membership.activate','membership_application',v_application.id::text,v_primary_member_id,jsonb_build_object('status',v_application.status,'applicationKind',v_application.application_kind,'basePriceCents',v_application.base_price_cents),jsonb_build_object('status','activated','applicationKind',v_application.application_kind,'membershipId',v_membership_id,'basePriceCents',v_application.base_price_cents,'discountAmountCents',v_discount_amount,'finalAmountCents',v_final_amount,'paymentMethod',v_application.payment_method,'members',v_affected_members));
  return jsonb_build_object('applicationId',v_application.id,'membershipId',v_membership_id,'applicationKind',v_application.application_kind,'members',v_affected_members,'idempotent',false);
end;
$function$
