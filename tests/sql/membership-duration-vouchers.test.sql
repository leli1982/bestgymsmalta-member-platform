-- Test project only; fictional fixtures rolled back.
begin;
do $test$
declare
 u uuid; a uuid; p uuid; g text; mode text; tag text; vcode text;
 app public.bgm_membership_applications%rowtype; v public.bgm_discount_codes%rowtype;
 res jsonb; quote jsonb; expected date; pct integer; ext integer; reimb integer; typ text; req boolean;
 dur text; kind text; rejectmsg text; actualmsg text; scope text; agym text;
begin
 select id into u from public.bgm_system_users where active and is_super_admin limit 1;
 if u is null then raise exception 'no test admin'; end if;
 foreach mode in array array['normal','percent','student_reimbursement','combined','approval','wrong_duration','renewal','expired','disabled','exhausted','stale','no_quote','wrong_gym','wrong_category','single_gym','duration_only'] loop
   tag:=replace(gen_random_uuid()::text,'-',''); vcode:='QA-'||tag;
   pct:=case mode when 'percent' then 10 when 'student_reimbursement' then 100 when 'combined' then 10 else 0 end;
   ext:=case when mode in ('normal','percent','student_reimbursement') then 0 else 2 end;
   reimb:=case when mode='student_reimbursement' then 30000 else null end;
   typ:=case when mode='student_reimbursement' then 'student' else 'single' end;
   dur:=case when mode='wrong_duration' then '3_months' else '6_months' end;
   kind:=case when mode='renewal' then 'renewal' else 'new' end;
   req:=mode='approval';
   scope:=case when mode='single_gym' then 'single_gym' else 'network' end;
   agym:=case when mode='single_gym' then 'bgm-neptunes' else null end;
   g:=case when mode='single_gym' then 'bgm-neptunes' else 'bgm-talqroqq' end;
   if mode<>'normal' then
     insert into public.bgm_discount_codes(code,percentage,extension_months,eligible_duration_keys,eligible_application_kinds,eligible_gym_ids,eligible_membership_types,active,valid_until,max_uses,successful_uses,reimbursement_value_cents,requires_verification)
     values(vcode,pct,ext,case when ext>0 then array['6_months'] else null end,case when ext>0 then array['new'] else null end,case when mode='wrong_gym' then array['bgm-neptunes'] else null end,case when mode='wrong_category' then array['student'] else null end,mode<>'disabled',case when mode='expired' then (now() at time zone 'Europe/Malta')::date-1 else null end,case when mode in ('exhausted','duration_only') then 1 else null end,case when mode='exhausted' then 1 else 0 end,reimb,req)
     returning * into v;
   end if;
   insert into public.bgm_membership_applications(application_reference,membership_type,duration_key,enrollment_gym_id,staff_name,status,application_kind,start_date,expiry_date,access_scope,access_gym_id)
   values('QA-'||tag,typ,dur,g,'QA only','submitted',kind,'2026-11-27',case when dur='3_months' then '2027-02-27'::date else '2027-05-27'::date end,scope,agym) returning * into app;
   a:=app.id;
   -- Renewal eligibility is checked before activation or participant writes.
   if mode<>'renewal' then
     insert into public.bgm_membership_application_members(application_id,participant_order,first_name,last_name,date_of_birth,id_verified_at,student_eligibility_verified_at)
     values(a,1,'QA','Duration '||tag,'1990-01-01',now(),case when typ='student' then now() else null end) returning id into p;
     insert into public.bgm_member_card_credentials(barcode_value,application_member_id,status) values('QA-'||tag,p,'reserved');
   end if;
   quote:=case when mode='normal' then null else public.bgm_membership_voucher_quote(v,app) end;
   rejectmsg:=case mode when 'wrong_duration' then 'not eligible' when 'renewal' then 'not eligible' when 'wrong_gym' then 'not eligible' when 'wrong_category' then 'not eligible' when 'expired' then 'unavailable' when 'disabled' then 'unavailable' when 'exhausted' then 'unavailable' when 'stale' then 'changed' when 'no_quote' then 'not confirmed' else null end;
   if mode='stale' then update public.bgm_discount_codes set extension_months=3 where id=v.id; end if;
   if rejectmsg is not null then
     actualmsg:=null;
     begin
       if mode='no_quote' then
         perform public.bgm_activate_membership_application(a,'cash',null,'QA only',vcode,u);
       else
         perform public.bgm_activate_membership_with_voucher_quote(a,'cash',null,'QA only',vcode,u,quote);
       end if;
     exception when others then actualmsg:=sqlerrm; end;
     if actualmsg is null or position(rejectmsg in actualmsg)=0 then raise exception 'case % incorrect rejection: %',mode,actualmsg; end if;
     if exists(select 1 from public.bgm_memberships where application_id=a) then raise exception 'rejected activation created membership %',mode; end if;
     continue;
   end if;
   if mode='approval' then
     actualmsg:=null;
     begin
       perform public.bgm_activate_membership_with_voucher_quote(a,'cash',null,'QA only',vcode,u,quote);
     exception when others then actualmsg:=sqlerrm; end;
     if actualmsg is null or position('approval' in actualmsg)=0 then raise exception 'unapproved promotion accepted %',actualmsg; end if;
     res:=public.bgm_request_voucher_approval(a,vcode,u);
     perform public.bgm_decide_voucher_approval((res->>'id')::uuid,'approved',u,'QA only');
   end if;
   if mode='normal' then
     res:=public.bgm_activate_membership_application(a,'cash',null,'QA only',null,u);
   elsif mode in ('percent','student_reimbursement') then
     res:=public.bgm_activate_membership_application(a,'cash',null,'QA only',vcode,u);
   else
     res:=public.bgm_activate_membership_with_voucher_quote(a,'cash',null,'QA only',vcode,u,quote);
   end if;
   expected:=public.bgm_add_voucher_months(app.expiry_date,ext);
   if not exists(select 1 from public.bgm_membership_applications x where x.id=a and x.status='activated' and x.expiry_date=expected and x.duration_key=dur and x.voucher_extension_months_snapshot=ext and x.final_amount_cents=app.base_price_cents-round(app.base_price_cents*pct/100.0)::integer and coalesce(x.discount_reimbursement_cents_snapshot,0)=coalesce(reimb,0)) then raise exception 'incorrect activation snapshot for %',mode; end if;
   if not exists(select 1 from public.bgm_memberships x join public.bgm_membership_members mm on mm.membership_id=x.id join public.bgm_members bm on bm.id=mm.member_id where x.application_id=a and x.expiry_date=expected and bm.membership_expiry=expected and bm.access_scope=scope and bm.access_gym_id is not distinct from agym) then raise exception 'incorrect membership scope or expiry for %',mode; end if;
   if mode='duration_only' then
     res:=public.bgm_activate_membership_with_voucher_quote(a,'cash',null,'QA only',vcode,u,quote);
     if res->>'idempotent'<>'true' or res->>'expiryDate'<>expected::text then raise exception 'retry failed'; end if;
     if (select successful_uses from public.bgm_discount_codes where id=v.id)<>1 then raise exception 'duplicate redemption'; end if;
     update public.bgm_discount_codes set active=false where id=v.id;
     if not exists(select 1 from public.bgm_memberships where application_id=a and expiry_date=expected) then raise exception 'disabled voucher changed existing expiry'; end if;
   end if;
 end loop;
 if public.bgm_add_voucher_months('2027-01-31',1)<>'2027-03-03' or public.bgm_add_voucher_months('2028-01-31',1)<>'2028-03-02' then raise exception 'calendar rollover mismatch'; end if;
end
$test$;
select 'PASS: 16 cases, approval, actual expiry, single-gym scope, retry, disable and date rollover' as result;
rollback;