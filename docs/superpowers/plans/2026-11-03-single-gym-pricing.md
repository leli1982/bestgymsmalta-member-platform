# Single Gym Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development.

**Goal:** Generalize PR #78's Neptunes-only access into `single_gym + access_gym_id`, extend the immutable pricing catalogue by scope/gym, and expose independent per-gym pricing in Super Admin, Staff and Tablet enrollment/renewal without changing existing All Access behavior.

**Tech Stack:** Next.js/TypeScript, Supabase/Postgres, node:test.

**Spec:** `docs/superpowers/specs/2026-11-03-single-gym-pricing-design.md`

## Global Constraints
- Production remains untouched until explicit approval.
- Schema rolls out backward-compatibly before generic code reads new fields.
- Existing All Access behavior is unchanged.
- Single Gym never falls back to network pricing.
- Legacy `neptunes_only` remains enforced during transition, then converts to generic scope only after generic enforcement is live.

### Task 1: Generic access + scoped pricing schema
- [ ] Add `access_gym_id` to members/applications while temporarily preserving `neptunes_only`.
- [ ] Add per-gym Single Gym capability; enable Neptunes initially.
- [ ] Scope immutable price catalogues by `network` or `single_gym + gym_id`.
- [ ] Publish/retire only within the same scope.
- [ ] Add contract tests and verify RED -> GREEN.

### Task 2: Generic barcode/NFC/offline enforcement
- [ ] Pass `access_gym_id` through barcode/NFC routes and shared evaluators.
- [ ] Carry target gym through offline roster and filter by current gym.
- [ ] Preserve legacy Neptunes behavior during transition without using pricing as access control.
- [ ] Return dynamic allowed-gym metadata for denial copy.

### Task 3: Super Admin Individual Gym Pricing
- [ ] Membership Settings loads gym master list + capability.
- [ ] Add enable/disable action with audit.
- [ ] Save/publish scoped per-gym draft matrix using existing 21-slot rules and active flags.
- [ ] Add Individual Gym Pricing UI; disabled state preserves historical prices.

### Task 4: Staff + Tablet enrollment
- [ ] Config exposes capability and scoped catalogue for current gym.
- [ ] Enabled gym first chooses All Access / Single Gym; disabled gym behaves exactly as today.
- [ ] Persist chosen scope + target gym on applications and offline queue.
- [ ] No fallback to network prices if Single Gym catalogue is missing/inactive.

### Task 5: Renewals and conversion semantics
- [ ] Preselect member's current access mode at enabled gym and allow deliberate change.
- [ ] Apply access conversion only when renewal becomes effective under existing date rules.
- [ ] Keep couples atomic.
- [ ] Convert legacy `neptunes_only` data to `single_gym + bgm-neptunes` only after generic enforcement is live.

### Task 6: Presentation + audit
- [ ] Dynamic wrong-gym denial copy: `<GYM NAME> ACCESS ONLY`.
- [ ] Include access mode/target gym in review/print/audit surfaces where relevant.

### Task 7: TEST rollout and regression
- [ ] Full tests/build.
- [ ] Verify existing All Access, couples, Staff, Tablet, barcode, NFC and offline paths.
- [ ] Verify fictional Single Gym members at multiple gyms and legacy Neptunes equivalence.
- [ ] Production changes only after explicit approval.
