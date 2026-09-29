-- Extend membership functions for the 1 Gym Session duration.
-- Existing published 18-entry catalogs remain readable; newly published
-- catalogs must contain the full 21-entry matrix.

do $migration$
declare
  v_def text;
begin
  select pg_get_functiondef('public.bgm_publish_membership_price_catalog(uuid,uuid)'::regprocedure) into v_def;
  v_def := replace(
    v_def,
    'if v_entry_count<>18 then raise exception ''A complete price catalog must contain exactly 18 entries.''; end if;',
    'if v_entry_count<>21 then raise exception ''A complete price catalog must contain exactly 21 entries.''; end if;'
  );
  execute v_def;

  select pg_get_functiondef('public.bgm_correct_membership_application(uuid,uuid,text,text,date,date,jsonb)'::regprocedure) into v_def;
  v_def := replace(
    v_def,
    'if p_duration_key not in (''1_week'',''2_weeks'',''1_month'',''3_months'',''6_months'',''1_year'') then',
    'if p_duration_key not in (''1_session'',''1_week'',''2_weeks'',''1_month'',''3_months'',''6_months'',''1_year'') then'
  );
  execute v_def;

  select pg_get_functiondef('public.bgm_create_public_membership_application(jsonb)'::regprocedure) into v_def;
  v_def := replace(
    v_def,
    'if v_duration_key not in (''1_week'',''2_weeks'',''1_month'',''3_months'',''6_months'',''1_year'') then',
    'if v_duration_key not in (''1_session'',''1_week'',''2_weeks'',''1_month'',''3_months'',''6_months'',''1_year'') then'
  );
  v_def := replace(
    v_def,
    'v_expiry_date := case v_duration_key' || chr(10) || '    when ''1_week'' then v_start_date + 7',
    'v_expiry_date := case v_duration_key' || chr(10) || '    when ''1_session'' then v_start_date' || chr(10) || '    when ''1_week'' then v_start_date + 7'
  );
  execute v_def;

  select pg_get_functiondef('public.bgm_apply_membership_application_review(jsonb)'::regprocedure) into v_def;
  v_def := replace(
    v_def,
    'if v_duration_key not in (''1_week'',''2_weeks'',''1_month'',''3_months'',''6_months'',''1_year'') then',
    'if v_duration_key not in (''1_session'',''1_week'',''2_weeks'',''1_month'',''3_months'',''6_months'',''1_year'') then'
  );
  execute v_def;
end
$migration$;
