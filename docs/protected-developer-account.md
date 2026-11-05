# Protected Developer account — TEST-first implementation

Purpose: allow the software developer an ordinary Super Admin feature set while preventing other Super Admins from seeing, editing, disabling, resetting or deleting this account through the application.

## Rollout (do not skip)
1. Apply the accompanying migration to **TEST Supabase only**.
2. Configure **BGM_DEVELOPER_RECOVERY_EMAIL** in **TEST Preview** as the developer's personal recovery address (never the customer's address or a shared gym address). Existing GMAIL_USER, GMAIL_APP_PASSWORD and optional GMAIL_FROM must work in that environment.
3. Provision **one** TEST Super Admin user using secure one-time credentials, then mark ONLY that exact record `is_protected_developer=true` through an owner-controlled database migration/query. Do not create this account through ordinary Super Admin UI as a protected account. The protection must be verified before issuing credentials. The migration deliberately does not assume a personal email or guess a username/password.
4. Check recovery at `/staff/developer-recovery`: request link, check delivery, reset password, confirm old password and old sessions are invalidated, confirm token cannot be reused, confirm expired token fails.
5. As normal Super Admin and using the legacy bootstrap-admin session, confirm the protected account is missing from `GET /api/admin/system-users`; PATCH guesses return 404. Test direct UPDATE/DELETE in an **isolated transaction rolled back** against TEST with the database trigger. Verify ordinary admins still work.
6. Run CI and real browser tests, then request explicit approval for Production deployment and migration. Provision Production account only *after* the Production migration and recovery configuration are verified.

## Security boundary
- Ordinary Super Admins cannot create protected users using system-user API; the flag is never accepted from request bodies.
- Protected accounts are filtered server-side before any list results are returned, including the legacy bootstrap-admin entry point.
- Database trigger blocks protected-user edits and deletion independently of API. Login only updates last_login_at/updated_at.
- Recovery uses 32 random bytes, SHA-256 token hashes at rest, 15-minute expiry, 3 links per hour and an atomic one-time database RPC restricted to service_role.
- Successful recovery invalidates previous Developer sessions using developer_password_changed_at.
- The customer has no GitHub/Vercel/Supabase administrative access. These protections do not prevent legitimate infrastructure owners with direct SQL access from making changes.
- Keep the Developer account and all administrative access rights consistent with the client contract. No hidden module deactivation or lockout features are added.

This feature does **not** touch member scanning, enrollments, the Members App, or role permissions for ordinary staff.
