-- Close pending voucher approval requests when an application is activated
-- without that voucher, or when the application is cancelled. Existing guard remains.
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

  if new.status in ('activated','cancelled')
     and old.status is distinct from new.status then
    update public.bgm_voucher_approval_requests
       set status='cancelled',updated_at=now()
     where application_id=new.id and status='pending';
  end if;
  return new;
end;
$$;

revoke all on function public.bgm_guard_membership_voucher_approval() from public,anon,authenticated;
grant execute on function public.bgm_guard_membership_voucher_approval() to service_role;
