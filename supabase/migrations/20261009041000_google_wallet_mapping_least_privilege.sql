-- Reconcile TEST environments that received the initial C4 Wallet mapping migration
-- before verification tightened service_role to CRUD-only. Safe and idempotent.

revoke all on table public.bgm_google_wallet_passes from anon, authenticated, service_role;
grant select, insert, update, delete on table public.bgm_google_wallet_passes to service_role;
