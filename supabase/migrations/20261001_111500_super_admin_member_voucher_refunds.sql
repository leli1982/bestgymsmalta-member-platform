-- Super Admin-only retroactive voucher correction and persistent refund alerts.

create table if not exists public.bgm_member_refund_alerts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete restrict,
  membership_id uuid not null references public.bgm_memberships(id) on delete restrict,
  application_id uuid not null references public.bgm_membership_applications(id) on delete restrict,
  voucher_code text not null,
  voucher_percentage integer not null check (voucher_percentage between 0 and 100),
  original_final_amount_cents integer not null check (original_final_amount_cents >= 0),
  corrected_final_amount_cents integer not null check (corrected_final_amount_cents >= 0),
  refund_due_cents integer not null check (refund_due_cents > 0),
  currency text not null default 'EUR',
  member_first_name text,
  member_last_name text,
  member_id_number text,
  member_mobile text,
  status text not null default 'pending' check (status in ('pending','handled')),
  created_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  handled_by_system_user_id uuid references public.bgm_system_users(id) on delete restrict,
  handled_at timestamptz,
  email_notification_status text not null default 'pending' check (email_notification_status in ('pending','sent','failed','disabled')),
  email_notification_sent_at timestamptz,
  email_notification_error text
);

create index if not exists bgm_member_refund_alerts_status_created_idx
  on public.bgm_member_refund_alerts(status, created_at desc);
create index if not exists bgm_member_refund_alerts_member_idx
  on public.bgm_member_refund_alerts(member_id, created_at desc);

alter table public.bgm_member_refund_alerts enable row level security;
revoke all on table public.bgm_member_refund_alerts from public, anon, authenticated;
grant all on table public.bgm_member_refund_alerts to service_role;

create or replace function public.bgm_super_admin_apply_member_voucher(
  p_system_user_id uuid,
  p_member_id uuid,
  p_membership_id uuid,
  p_expected_application_updated_at timestamptz,
  p_voucher_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.bgm_super_admin_apply_member_voucher(uuid, uuid, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_apply_member_voucher(uuid, uuid, uuid, timestamptz, text)
  to service_role;

create or replace function public.bgm_super_admin_mark_refund_handled(
  p_system_user_id uuid,
  p_alert_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert public.bgm_member_refund_alerts%rowtype;
begin
  if not exists (
    select 1 from public.bgm_system_users
    where id = p_system_user_id and active = true and is_super_admin = true
  ) then
    raise exception 'Super Admin access required.';
  end if;

  select * into v_alert
  from public.bgm_member_refund_alerts
  where id = p_alert_id
  for update;
  if not found then raise exception 'Refund alert not found.'; end if;

  if v_alert.status = 'handled' then
    return jsonb_build_object('changed', false, 'status', 'handled');
  end if;

  update public.bgm_member_refund_alerts
  set status = 'handled',
      handled_by_system_user_id = p_system_user_id,
      handled_at = clock_timestamp()
  where id = p_alert_id;

  insert into public.bgm_audit_log (
    system_user_id, action_key, entity_type, entity_id, member_id,
    before_data, after_data
  ) values (
    p_system_user_id, 'member.refund.handled', 'member_refund_alert',
    p_alert_id::text, v_alert.member_id,
    jsonb_build_object('status', 'pending', 'refundDueCents', v_alert.refund_due_cents),
    jsonb_build_object('status', 'handled', 'refundDueCents', v_alert.refund_due_cents)
  );

  return jsonb_build_object('changed', true, 'status', 'handled');
end;
$$;

revoke all on function public.bgm_super_admin_mark_refund_handled(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_mark_refund_handled(uuid, uuid)
  to service_role;


-- Expand the existing Super Admin profile editor to every legitimate member detail
-- while keeping permanent identifiers, credentials and system/audit metadata immutable.
create or replace function public.bgm_super_admin_update_member_profile(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_updated_at timestamptz,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.bgm_members%rowtype;
  v_after public.bgm_members%rowtype;
  v_keys text[] := array[
    'firstName','lastName','email','mobile','phone','telephoneNo1','telephoneNo2',
    'dateOfBirth','idNumber','addressLine1','addressLine2','town','postcode','country',
    'companyName','gender','nextOfKin','notes'
  ];
  v_old jsonb;
  v_new jsonb;
begin
  if not exists (
    select 1 from public.bgm_system_users
    where id = p_system_user_id and active = true and is_super_admin = true
  ) then raise exception 'Super Admin access required.'; end if;

  if p_profile is null or jsonb_typeof(p_profile) <> 'object'
    or (select count(*) from jsonb_object_keys(p_profile)) <> array_length(v_keys,1)
    or exists (select 1 from jsonb_object_keys(p_profile) k where not (k.key = any(v_keys)))
    or exists (select 1 from jsonb_each(p_profile) f where jsonb_typeof(f.value) not in ('string','null'))
  then raise exception 'Invalid member profile fields.'; end if;

  select * into v_before from public.bgm_members where id = p_member_id for update;
  if not found then raise exception 'Member not found.'; end if;
  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'This member changed since you opened the editor. Reload before saving.';
  end if;

  if nullif(btrim(p_profile->>'firstName'),'') is null
    or nullif(btrim(p_profile->>'lastName'),'') is null then
    raise exception 'Enter a first and last name (100 characters maximum each).';
  end if;
  if length(btrim(p_profile->>'firstName')) > 100 or length(btrim(p_profile->>'lastName')) > 100 then
    raise exception 'Enter a first and last name (100 characters maximum each).';
  end if;
  if length(coalesce(p_profile->>'email','')) > 254
    or (nullif(btrim(p_profile->>'email'),'') is not null
      and btrim(p_profile->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
  then raise exception 'Enter a valid email address.'; end if;
  if exists (select 1 from jsonb_each_text(p_profile) f where length(coalesce(f.value,'')) > 500)
  then raise exception 'A member profile field is too long.'; end if;
  if nullif(p_profile->>'dateOfBirth','') is not null then
    if p_profile->>'dateOfBirth' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or (p_profile->>'dateOfBirth')::date > (now() at time zone 'Europe/Malta')::date
    then raise exception 'Enter a valid date of birth.'; end if;
  end if;

  v_old := to_jsonb(v_before);

  update public.bgm_members set
    first_name = btrim(p_profile->>'firstName'),
    last_name = btrim(p_profile->>'lastName'),
    full_name = btrim(p_profile->>'firstName') || ' ' || btrim(p_profile->>'lastName'),
    email = nullif(lower(btrim(p_profile->>'email')),''),
    mobile = nullif(btrim(p_profile->>'mobile'),''),
    phone = nullif(btrim(p_profile->>'phone'),''),
    telephone_no_1 = nullif(btrim(p_profile->>'telephoneNo1'),''),
    telephone_no_2 = nullif(btrim(p_profile->>'telephoneNo2'),''),
    date_of_birth = nullif(p_profile->>'dateOfBirth','')::date,
    id_number = nullif(btrim(p_profile->>'idNumber'),''),
    address_line_1 = nullif(btrim(p_profile->>'addressLine1'),''),
    address_line_2 = nullif(btrim(p_profile->>'addressLine2'),''),
    town = nullif(btrim(p_profile->>'town'),''),
    postcode = nullif(btrim(p_profile->>'postcode'),''),
    country = nullif(btrim(p_profile->>'country'),''),
    company_name = nullif(btrim(p_profile->>'companyName'),''),
    gender = nullif(btrim(p_profile->>'gender'),''),
    next_of_kin = nullif(btrim(p_profile->>'nextOfKin'),''),
    notes = nullif(btrim(p_profile->>'notes'),''),
    updated_at = clock_timestamp()
  where id = p_member_id
  returning * into v_after;

  v_new := to_jsonb(v_after);
  if v_old is distinct from v_new then
    insert into public.bgm_audit_log(
      system_user_id,context_gym_id,action_key,entity_type,entity_id,member_id,before_data,after_data
    ) values (
      p_system_user_id,v_before.enrollment_gym_id,'member.profile.update','member',
      p_member_id::text,p_member_id,v_old,v_new
    );
  end if;

  return jsonb_build_object('id',v_after.id,'updatedAt',v_after.updated_at);
end;
$$;

revoke all on function public.bgm_super_admin_update_member_profile(uuid,uuid,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_update_member_profile(uuid,uuid,timestamptz,jsonb)
  to service_role;
