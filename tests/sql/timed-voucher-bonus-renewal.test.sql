begin;
do $test$
declare u uuid; v public.bgm_discount_codes%rowtype; app public.bgm_membership_applications%rowtype; a uuid; p uuid; m uuid; res jsonb; tag text:=replace(gen_random_uuid()::text,'-',''); today date:=(now() at time zone 'Europe/Malta')::date; initial_expiry date; renewal_expiry date;
begin
 select id into u from public.bgm_system_users where active and is_super_admin limit 1;
 insert into public.bgm_discount_codes(code,percentage,active,reimbursement_value_cents,bonus_months,bonus_valid_from,bonus_valid_until)
 values('QA-'||tag,100,true,30000,2,today,today) returning * into v;
 insert into public.bgm_membership_applications(application_reference,membership_type,duration_key,enrollment_gym_id,staff_name,status,application_kind,start_date,expiry_date,access_scope)
 values('QA-NEW-'||tag,'single','1_month','bgm-talqroqq','QA only','submitted','new',today,public.bgm_add_voucher_months(today,1),'network') returning * into app;
 a:=app.id;
 insert into public.bgm_membership_application_members(application_id,participant_order,first_name,last_name,date_of_birth,id_verified_at)
 values(a,1,'QA','Renewal '||tag,'1990-01-01',now()) returning id into p;
 insert into public.bgm_member_card_credentials(barcode_value,application_member_id,status) values('QA-'||tag,p,'reserved');
 res:=public.bgm_activate_membership_with_voucher_quote(a,'cash',null,'QA only',v.code,u,public.bgm_membership_voucher_quote(v,app));
 m:=(res->'members'->0->>'memberId')::uuid;
 initial_expiry:=public.bgm_add_voucher_months(app.expiry_date,2);
 if not exists(select 1 from public.bgm_members where id=m and membership_expiry=initial_expiry) then raise exception 'new membership wrong expiry'; end if;
 if not exists(select 1 from public.bgm_membership_applications where id=a and discount_reimbursement_cents_snapshot=30000 and final_amount_cents=0 and voucher_extension_months_snapshot=2) then raise exception 'new reimbursement or extension incorrect'; end if;
 select * into v from public.bgm_discount_codes where id=v.id;
 insert into public.bgm_membership_applications(application_reference,membership_type,duration_key,enrollment_gym_id,staff_name,status,application_kind,start_date,expiry_date,access_scope)
 values('QA-RENEW-'||tag,'single','1_month','bgm-talqroqq','QA only','submitted','renewal',initial_expiry+1,public.bgm_add_voucher_months(initial_expiry+1,1),'network') returning * into app;
 a:=app.id;
 insert into public.bgm_membership_application_members(application_id,participant_order,first_name,last_name,date_of_birth,id_verified_at,existing_member_id,identity_match_state,renewal_card_action,renewal_scanned_barcode,renewal_card_verified_at)
 values(a,1,'QA','Renewal '||tag,'1990-01-01',now(),m,'active','keep','QA-'||tag,now());
 res:=public.bgm_activate_membership_with_voucher_quote(a,'cash',null,'QA only',v.code,u,public.bgm_membership_voucher_quote(v,app));
 renewal_expiry:=public.bgm_add_voucher_months(app.expiry_date,2);
 if not exists(select 1 from public.bgm_members where id=m and membership_expiry=renewal_expiry) then raise exception 'renewal wrong expiry'; end if;
 -- Existing business-date trigger snapshots reimbursement ONLY for new applications;
 -- do not change the renewal accounting path as part of this promotion.
 if not exists(select 1 from public.bgm_membership_applications where id=a and discount_reimbursement_cents_snapshot is null and final_amount_cents=0 and voucher_extension_months_snapshot=2) then raise exception 'renewal accounting or extension incorrect'; end if;
 if (select successful_uses from public.bgm_discount_codes where id=v.id)<>2 then raise exception 'incorrect uses'; end if;
 if not exists(select 1 from public.bgm_member_card_credentials where member_id=m and barcode_value='QA-'||tag and status='active') then raise exception 'renewal card changed'; end if;
end $test$;
select 'PASS: new and early renewal, same card, existing reimbursement rules, actual expiry' result;
rollback;