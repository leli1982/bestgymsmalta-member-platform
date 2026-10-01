-- Legacy/imported-member voucher corrections.
-- These members have current membership state on bgm_members but no payment application.
-- Super Admin must explicitly confirm the historical amount paid; no financial value is inferred.

create table if not exists public.bgm_legacy_member_voucher_corrections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.bgm_members(id) on delete restrict,
  voucher_code_id uuid references public.bgm_discount_codes(id) on delete set null,
  voucher_code text not null,
  voucher_percentage integer not null check (voucher_percentage between 0 and 100),
  confirmed_original_paid_cents integer not null check (confirmed_original_paid_cents > 0),
  corrected_final_amount_cents integer not null check (corrected_final_amount_cents >= 0),
  refund_due_cents integer not null check (refund_due_cents > 0),
  currency text not null default 'EUR',
  membership_expiry_snapshot date,
  member_enrollment_date_snapshot date,
  enrollment_gym_id_snapshot text,
  member_first_name text,
  member_last_name text,
  member_id_number text,
  member_mobile text,
  created_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  applied_at timestamptz not null default now()
);

create unique index if not exists bgm_legacy_voucher_one_per_current_membership_idx
  on public.bgm_legacy_member_voucher_corrections (
    member_id,
    coalesce(membership_expiry_snapshot, date '0001-01-01')
  );

create index if not exists bgm_legacy_voucher_code_applied_idx
  on public.bgm_legacy_member_voucher_corrections(voucher_code, applied_at desc);

alter table public.bgm_legacy_member_voucher_corrections enable row level security;
revoke all on table public.bgm_legacy_member_voucher_corrections from public, anon, authenticated;
grant all on table public.bgm_legacy_member_voucher_corrections to service_role;

alter table public.bgm_member_refund_alerts
  alter column membership_id drop not null,
  alter column application_id drop not null;

alter table public.bgm_member_refund_alerts
  add column if not exists legacy_correction_id uuid
    references public.bgm_legacy_member_voucher_corrections(id) on delete restrict;

create index if not exists bgm_member_refund_alerts_legacy_correction_idx
  on public.bgm_member_refund_alerts(legacy_correction_id);

create or replace function public.bgm_super_admin_apply_legacy_member_voucher(
  p_system_user_id uuid,
  p_member_id uuid,
  p_expected_member_updated_at timestamptz,
  p_voucher_code text,
  p_original_paid_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.bgm_super_admin_apply_legacy_member_voucher(uuid, uuid, timestamptz, text, integer)
  from public, anon, authenticated;
grant execute on function public.bgm_super_admin_apply_legacy_member_voucher(uuid, uuid, timestamptz, text, integer)
  to service_role;
