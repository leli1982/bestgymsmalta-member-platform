# C3 Member Engagement Push Notifications — Default-ON Amendment

Date: 2026-10-08
Branch: `feature/member-engagement-push-c3`

## Status

This amendment supersedes only the **default rollout state** described in:

- `docs/superpowers/specs/2026-10-08-member-engagement-push-c3.md`
- `docs/superpowers/plans/2026-10-08-member-engagement-push-c3.md`

All other C3 eligibility, attendance, dedupe, security, push-delivery, UI, and physical-access rules remain unchanged.

## Revised owner requirement

All C3 notification categories are enabled by default:

- critical membership notifications: **ON**;
- motivational notifications: **ON**;
- global member engagement processing: **ON**;
- inactivity notifications: **ON**;
- streak notifications: **ON**.

Opt-out and kill-switch controls remain available:

- members may disable critical and/or motivational account categories;
- a device must still have browser notification permission and an active push subscription;
- Super Admin may disable global engagement, inactivity notifications, and/or streak notifications.

## Migration history

The original migration, `20261008203000_member_engagement_notifications.sql`, is intentionally preserved unchanged. It historically created the global engagement singleton with `enabled = false`.

The additive follow-up migration, `20261008211500_member_engagement_enabled_by_default.sql`, changes the effective database default to `true` and enables the existing singleton without overriding the inactivity/streak switches.

This preserves migration history while implementing the revised owner requirement.

## Verified rollout

TEST Supabase:

- original C3 schema applied;
- default-ON follow-up applied;
- global engagement = ON;
- inactivity = ON;
- streaks = ON;
- critical preference default = ON;
- motivational preference default = ON.

Production Supabase:

- original C3 schema is tracked as `20261008211000 member_engagement_notifications`;
- default-ON follow-up is tracked as `20261008223709 member_engagement_enabled_by_default`;
- global engagement = ON;
- inactivity = ON;
- streaks = ON;
- engagement database default = ON;
- critical preference default = ON;
- motivational preference default = ON.

C3 tables remain server-managed with RLS enabled and no `anon`/`authenticated` table grants.

## Deployment gate

Database/schema rollout being ready does not by itself make the new C3 processing code live in the Production application.

PR #37 must still be explicitly approved for merge and deployed to `main` before the new engagement engine is live in Production.
