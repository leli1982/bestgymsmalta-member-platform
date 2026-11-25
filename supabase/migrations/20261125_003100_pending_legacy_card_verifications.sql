create table if not exists public.bgm_pending_legacy_card_verifications (
 scan3 text not null check(scan3=upper(btrim(scan3)) and scan3<>''),
 member_id uuid not null references public.bgm_members(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','verified','not_owner')),
 source_row_number integer,
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by_system_user_id uuid references public.bgm_system_users(id),
 primary key(scan3,member_id)
);
alter table public.bgm_pending_legacy_card_verifications enable row level security;
revoke all on public.bgm_pending_legacy_card_verifications from public,anon,authenticated;
grant select,insert,update on public.bgm_pending_legacy_card_verifications to service_role;
create table if not exists public.bgm_missing_member_identity_review (
 source_row_number integer primary key, legacy_pk_customer text, source_scan3 text,
 source_data jsonb not null, review_reason text not null,
 status text not null default 'pending' check(status in ('pending','resolved')),
 created_at timestamptz not null default now()
);
alter table public.bgm_missing_member_identity_review enable row level security;
revoke all on public.bgm_missing_member_identity_review from public,anon,authenticated;
grant select,insert,update on public.bgm_missing_member_identity_review to service_role;
