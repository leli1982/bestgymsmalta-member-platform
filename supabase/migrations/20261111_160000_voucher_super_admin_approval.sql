-- Voucher approval: opt-in, application-bound, server-enforced.
-- No existing vouchers are opted in. No payment, voucher reimbursement or EOD calculation changes.
alter table public.bgm_discount_codes
  add column if not exists requires_verification boolean not null default false;

create table if not exists public.bgm_voucher_approval_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.bgm_membership_applications(id) on delete restrict,
  voucher_id uuid not null references public.bgm_discount_codes(id) on delete restrict,
  voucher_code text not null,
  voucher_terms jsonb not null,
  gym_id text not null,
  requested_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_voucher_approval_one_open_request_per_application
  on public.bgm_voucher_approval_requests(application_id)
  where status in ('pending','approved');
create index if not exists bgm_voucher_approval_pending_order
  on public.bgm_voucher_approval_requests(status,requested_at desc);
create index if not exists bgm_voucher_approval_application_history
  on public.bgm_voucher_approval_requests(application_id,requested_at desc);

alter table public.bgm_voucher_approval_requests enable row level security;
revoke all on table public.bgm_voucher_approval_requests from public,anon,authenticated;
grant select,insert,update on table public.bgm_voucher_approval_requests to service_role;

-- Snapshot only voucher terms that change the commercial decision. Successful-use
-- counters and updated_at legitimately change on activation and must NOT expire approval.
create or replace function public.bgm_voucher_approval_terms(p_voucher public.bgm_discount_codes)
returns jsonb language sql stable set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'code',p_voucher.code,
    'percentage',p_voucher.percentage,
    'active',p_voucher.active,
    'validFrom',p_voucher.valid_from,
    'validUntil',p_voucher.valid_until,
    'maxUses',p_voucher.max_uses,
    'reimbursementCents',p_voucher.reimbursement_value_cents,
    'requiresVerification',p_voucher.requires_verification
  );
$$;

create or replace function public.bgm_request_voucher_approval(
  p_application_id uuid, p_voucher_code text, p_system_user_id uuid
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
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
$$;

create or replace function public.bgm_decide_voucher_approval(
  p_request_id uuid, p_decision text, p_system_user_id uuid, p_note text default null
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_actor public.bgm_system_users%rowtype;
  v_application public.bgm_membership_applications%rowtype;
  v_request public.bgm_voucher_approval_requests%rowtype;
  v_voucher public.bgm_discount_codes%rowtype;
  v_today date := (now() at time zone 'Europe/Malta')::date;
  v_decision text := lower(btrim(coalesce(p_decision,'')));
begin
  if v_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;
  select * into v_actor from public.bgm_system_users
    where id=p_system_user_id and active=true and (is_super_admin=true or role='super_admin');
  if not found then raise exception 'Super Admin access is required.'; end if;

  -- Lock in the same order as application activation and request creation.
  select a.* into v_application from public.bgm_membership_applications a
    join public.bgm_voucher_approval_requests r on r.application_id=a.id
    where r.id=p_request_id for update of a;
  if not found then raise exception 'Voucher approval request not found.'; end if;
  if v_application.status not in ('submitted','awaiting_payment') then
    raise exception 'Membership application is no longer awaiting payment.';
  end if;
  select * into v_request from public.bgm_voucher_approval_requests
    where id=p_request_id for update;
  if not found or v_request.status<>'pending' then
    raise exception 'Voucher approval request is no longer pending.';
  end if;

  if v_decision='approved' then
    select * into v_voucher from public.bgm_discount_codes
      where id=v_request.voucher_id for update;
    if not found or not v_voucher.requires_verification or not v_voucher.active
       or (v_voucher.valid_from is not null and v_today<v_voucher.valid_from)
       or (v_voucher.valid_until is not null and v_today>v_voucher.valid_until)
       or (v_voucher.max_uses is not null and v_voucher.successful_uses>=v_voucher.max_uses)
       or public.bgm_voucher_approval_terms(v_voucher)<>v_request.voucher_terms then
      raise exception 'Voucher settings changed or voucher unavailable. Staff must submit a new request.';
    end if;
  end if;

  update public.bgm_voucher_approval_requests
    set status=v_decision, reviewed_by_system_user_id=p_system_user_id,
        reviewed_at=now(),decision_note=nullif(btrim(coalesce(p_note,'')),''),
        updated_at=now()
    where id=p_request_id;

  insert into public.bgm_audit_log (
    system_user_id,context_gym_id,staff_name,action_key,entity_type,entity_id,after_data
  ) values (
    p_system_user_id,v_request.gym_id,v_actor.display_name,
    'voucher.approval.'||v_decision,'membership_application',v_application.id::text,
    pg_catalog.jsonb_build_object('requestId',p_request_id,'voucherCode',v_request.voucher_code,'decision',v_decision,'note',nullif(btrim(coalesce(p_note,'')),''))
  );
  return pg_catalog.jsonb_build_object('id',p_request_id,'status',v_decision);
end;
$$;

-- Last line of defense: even a direct RPC call, stale tab, or forged request
-- cannot activate a verification-required discount without the matching decision.
create or replace function public.bgm_guard_membership_voucher_approval()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_voucher public.bgm_discount_codes%rowtype;
begin
  if new.status='activated' and old.status is distinct from 'activated'
     and new.discount_code_id is not null then
    select * into v_voucher from public.bgm_discount_codes where id=new.discount_code_id;
    if found and v_voucher.requires_verification
       and not exists (
         select 1 from public.bgm_voucher_approval_requests r
         where r.application_id=new.id and r.voucher_id=v_voucher.id
           and r.status='approved'
           and r.voucher_terms=public.bgm_voucher_approval_terms(v_voucher)
       ) then
      raise exception 'Voucher requires Super Admin approval before activation.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bgm_guard_membership_voucher_approval on public.bgm_membership_applications;
create trigger bgm_guard_membership_voucher_approval
  before update of status on public.bgm_membership_applications
  for each row execute function public.bgm_guard_membership_voucher_approval();

revoke all on function public.bgm_voucher_approval_terms(public.bgm_discount_codes) from public,anon,authenticated;
revoke all on function public.bgm_request_voucher_approval(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.bgm_decide_voucher_approval(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.bgm_guard_membership_voucher_approval() from public,anon,authenticated;
grant execute on function public.bgm_voucher_approval_terms(public.bgm_discount_codes) to service_role;
grant execute on function public.bgm_request_voucher_approval(uuid,text,uuid) to service_role;
grant execute on function public.bgm_decide_voucher_approval(uuid,text,uuid,text) to service_role;
grant execute on function public.bgm_guard_membership_voucher_approval() to service_role;
