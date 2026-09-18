-- Allow renewals for an already-active member when the selected existing
-- member is the exact identity match. New memberships must still reject
-- active identities.

create or replace function public.bgm_enforce_membership_application_identity_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_classification jsonb;
  v_state text;
  v_application_kind text;
begin
  select a.application_kind
  into v_application_kind
  from public.bgm_membership_applications a
  where a.id = new.application_id;

  if v_application_kind is null then
    raise exception 'Membership application was not found.';
  end if;

  v_classification := public.bgm_classify_membership_identity(new.id_number);
  v_state := coalesce(v_classification->>'state', 'clear');

  new.identity_match_state := v_state;
  new.matched_member_id := nullif(v_classification->>'matchedMemberId', '')::uuid;

  if v_application_kind = 'new' then
    if v_state = 'active' then
      raise exception 'An active membership already exists for this identity.';
    end if;

    if tg_op = 'INSERT'
      or new.existing_member_id is distinct from new.matched_member_id then
      new.existing_member_id := null;
    end if;
  elsif v_application_kind = 'renewal' then
    if new.existing_member_id is null then
      raise exception 'Renewal requires an existing member.';
    end if;

    if new.matched_member_id is null
      or new.existing_member_id is distinct from new.matched_member_id then
      raise exception 'Selected renewal member no longer matches this identity.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.bgm_enforce_membership_application_identity_match()
  from public, anon, authenticated;
grant execute on function public.bgm_enforce_membership_application_identity_match()
  to service_role;
