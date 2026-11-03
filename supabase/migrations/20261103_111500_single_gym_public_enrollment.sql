-- Make the tablet/public enrollment RPC authoritative for network vs Single Gym access.
-- This patches the current function definition in place so all existing validation stays intact.

do $migration$
declare
  v_def text;
  v_before text;
begin
  select pg_get_functiondef('public.bgm_create_public_membership_application(jsonb)'::regprocedure)
  into v_def;

  v_before := v_def;
  v_def := replace(
    v_def,
    '  v_membership_type text;' || chr(10) || '  v_duration_key text;',
    '  v_membership_type text;' || chr(10) || '  v_access_scope text;' || chr(10) || '  v_duration_key text;'
  );
  if v_def = v_before then raise exception 'Could not add tablet access-scope variable.'; end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    '  v_membership_type := btrim(coalesce(p_payload->>''membershipType'', ''''));' || chr(10) || '  v_duration_key := btrim(coalesce(p_payload->>''durationKey'', ''''));',
    '  v_membership_type := btrim(coalesce(p_payload->>''membershipType'', ''''));' || chr(10) || '  v_access_scope := btrim(coalesce(p_payload->>''accessScope'', ''network''));' || chr(10) || '  v_duration_key := btrim(coalesce(p_payload->>''durationKey'', ''''));'
  );
  if v_def = v_before then raise exception 'Could not read tablet access scope.'; end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    '  if v_membership_type not in (''single'',''student'',''couples'') then raise exception ''Unsupported membership type.''; end if;',
    '  if v_membership_type not in (''single'',''student'',''couples'') then raise exception ''Unsupported membership type.''; end if;' || chr(10) ||
    '  if v_access_scope not in (''network'',''single_gym'') then raise exception ''Unsupported membership access scope.''; end if;' || chr(10) ||
    '  if v_access_scope = ''single_gym'' and not exists (select 1 from public.bgm_gyms g where g.id=v_gym_id and g.single_gym_pricing_enabled is true) then raise exception ''Single Gym membership is not available for this gym.''; end if;'
  );
  if v_def = v_before then raise exception 'Could not add tablet access-scope validation.'; end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    '  where c.status=''published'' and e.membership_type=v_membership_type and e.duration_key=v_duration_key',
    '  where c.status=''published'' and c.access_scope=v_access_scope and ((v_access_scope=''network'' and c.gym_id is null) or (v_access_scope=''single_gym'' and c.gym_id=v_gym_id)) and e.membership_type=v_membership_type and e.duration_key=v_duration_key and e.is_active is not false'
  );
  if v_def = v_before then raise exception 'Could not scope tablet price lookup.'; end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    '    id,application_reference,membership_type,duration_key,enrollment_gym_id,staff_name,application_kind,start_date,expiry_date,status,submitted_by_system_user_id,submitted_at,application_source,submitted_on_malta,base_price_cents,currency,price_catalog_version_id,gym_rules_version_id,privacy_version_id,health_version_id,declaration_snapshot,document_readiness_ack_at',
    '    id,application_reference,membership_type,duration_key,enrollment_gym_id,access_scope,access_gym_id,staff_name,application_kind,start_date,expiry_date,status,submitted_by_system_user_id,submitted_at,application_source,submitted_on_malta,base_price_cents,currency,price_catalog_version_id,gym_rules_version_id,privacy_version_id,health_version_id,declaration_snapshot,document_readiness_ack_at'
  );
  if v_def = v_before then raise exception 'Could not add tablet access columns.'; end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    '    v_application_id,v_reference,v_membership_type,v_duration_key,v_gym_id,null,''new'',v_start_date,v_expiry_date,''submitted'',null,now(),''tablet'',v_start_date,v_base_price_cents,''EUR'',v_price_catalog_version_id,v_gym_rules.id,v_privacy.id,v_health.id,v_declaration_snapshot,v_ack_at',
    '    v_application_id,v_reference,v_membership_type,v_duration_key,v_gym_id,v_access_scope,case when v_access_scope=''single_gym'' then v_gym_id else null end,null,''new'',v_start_date,v_expiry_date,''submitted'',null,now(),''tablet'',v_start_date,v_base_price_cents,''EUR'',v_price_catalog_version_id,v_gym_rules.id,v_privacy.id,v_health.id,v_declaration_snapshot,v_ack_at'
  );
  if v_def = v_before then raise exception 'Could not persist tablet access scope.'; end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    '''membershipType'',v_membership_type,''durationKey'',v_duration_key,''participantCount''',
    '''membershipType'',v_membership_type,''accessScope'',v_access_scope,''accessGymId'',case when v_access_scope=''single_gym'' then v_gym_id else null end,''durationKey'',v_duration_key,''participantCount'''
  );
  if v_def = v_before then raise exception 'Could not audit tablet access scope.'; end if;

  execute v_def;
end
$migration$;
