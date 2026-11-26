-- A campaign bonus supplements the original voucher rather than replacing its terms.
alter table public.bgm_discount_codes
  drop constraint bgm_discount_codes_timed_bonus_check,
  add constraint bgm_discount_codes_timed_bonus_check check (
    (bonus_months=0 and bonus_valid_from is null and bonus_valid_until is null)
    or (bonus_months between 1 and 120 and extension_months+bonus_months<=120
      and bonus_valid_from is not null and bonus_valid_until is not null
      and bonus_valid_from<=bonus_valid_until)
  );

create or replace function public.bgm_voucher_effective_extension(p_voucher public.bgm_discount_codes,p_today date)
returns integer language sql immutable strict set search_path='' as $$
 select p_voucher.extension_months + case when p_voucher.bonus_months>0 and p_today between p_voucher.bonus_valid_from and p_voucher.bonus_valid_until
   then p_voucher.bonus_months else 0 end;
$$;
