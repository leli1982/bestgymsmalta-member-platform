# Single Gym Pricing Design

## Intent
BestGymsMalta must support both network-wide memberships and gym-specific memberships without hard-coding Neptunes or using vouchers to simulate access pricing. The feature must work for every current and future gym while preserving the existing All Access pricing and enrollment behaviour for gyms that do not enable single-gym pricing.

## Goals
- Add a per-gym **Single Gym Pricing** capability controlled by Super Admin.
- Populate the management list from the existing gym master list so new gyms appear automatically.
- Default Single Gym Pricing to disabled for new/current gyms, except Neptunes, which is enabled initially.
- Give each enabled gym its own independent price catalogue using the same membership types, durations, active/inactive controls, and versioning principles as the current pricing system.
- Keep normal **All Access** pricing completely separate and unchanged.
- At an enabled gym, Staff Portal and Tablet new-enrollment flows begin with two access choices: **All Access** and **Single Gym**.
- Renewals at an enabled gym begin with the same two choices and preselect the member's current access type while allowing staff to change it.
- When Single Gym Pricing is disabled for a gym, the access-choice screen is hidden and enrollment/renewal behaves exactly like today's All Access workflow.
- A Single Gym membership grants access only to the gym that sold/owns that single-gym membership.
- Reuse the current pricing structure rather than creating a Neptunes-specific parallel system.

## Non-goals
- No changes to the existing network All Access prices merely because this feature exists.
- No automatic fallback from a missing Single Gym price to an All Access price.
- No retrospective conversion of existing network members when a gym enables Single Gym Pricing.
- No hard-coded Neptunes-only pricing engine. Neptunes is merely the first enabled gym.
- No change to unrelated scanner, Bar, End of Day, payroll, or attendance behaviour.

## User Experience

### Super Admin — Gym Management
Add an **Individual Gym Pricing** section backed by the master gym list.

Each gym row shows:
- gym name;
- current gym status;
- **Single Gym Pricing** checkbox/toggle.

Rules:
- the list automatically reflects current/future gyms;
- Single Gym Pricing is off by default;
- Neptunes is enabled during rollout;
- disabling the switch hides the Single Gym choice from staff/tablet but preserves saved prices for later re-enabling;
- a newly added gym receives no Single Gym prices until Super Admin configures them.

When Single Gym Pricing is enabled, Super Admin can edit that gym's pricing matrix using the same structure as the existing membership settings screen:
- Regular / Adult rules currently supported by the existing system;
- Student rules currently supported by the existing system;
- Couples rules currently supported by the existing system;
- all existing duration keys;
- amount in EUR;
- active/inactive per duration/type;
- prospective pricing/version behaviour consistent with the existing catalogue.

An inactive Single Gym entry is unavailable for sale. There is no fallback to network pricing.

### New Enrollment — Staff Portal and Tablet
For a staff/tablet session belonging to a gym with Single Gym Pricing enabled, the first membership choice is:

1. **All Access**
2. **Single Gym**

Then the existing enrollment workflow continues.

- All Access loads the current network pricing catalogue.
- Single Gym loads the current catalogue for the logged-in/enrollment gym.
- Only active entries from the selected catalogue are offered.
- If Single Gym Pricing is disabled for that gym, the access-choice step does not appear and the existing flow proceeds directly as All Access.

### Renewal — Staff Portal and Tablet
For a gym with Single Gym Pricing enabled, renewal starts with the same access choice.

- Existing network member: **All Access** preselected.
- Existing single-gym member for that gym: **Single Gym** preselected.
- Staff may deliberately change the selection before continuing.
- The selected catalogue then controls duration availability and price.
- Changing from Single Gym to All Access widens access after activation according to the normal renewal effective-date rules.
- Changing from All Access to Single Gym restricts the renewed membership to the enrollment gym after activation according to the normal renewal effective-date rules.

For a gym without Single Gym Pricing enabled, renewal remains the current All Access flow.

## Access Model
Replace Neptunes-specific business meaning with a generic scope that can identify the allowed gym.

Conceptually:
- `network` = All Access to eligible BGM gyms.
- `single_gym` + `access_gym_id` = access only to that gym.

The current `neptunes_only` data introduced by PR #78 must be migrated safely to the generic model with `access_gym_id = bgm-neptunes`, without changing which members can currently enter Neptunes or be denied elsewhere.

Scanner, NFC and offline-roster enforcement must use the generic scope, not gym-name or Neptunes-specific conditionals.

## Pricing Architecture
The recommended architecture extends the existing catalogue model with pricing scope rather than building separate tables per gym.

A published/current pricing version is identified by:
- access scope: `network` or `single_gym`;
- gym id: null for network, concrete gym id for single-gym pricing.

Each version contains the same type × duration matrix and active flags used today.

Safety rules:
- network catalogue behaviour remains backward-compatible;
- Single Gym prices never inherit from or silently fall back to network prices;
- disabling a gym's Single Gym capability does not delete historical catalogues;
- historical applications retain their quoted/catalogue price information;
- new pricing applies prospectively in the same manner as the current system.

## Gym Capability Architecture
Store a per-gym capability flag on the gym record or a one-to-one gym settings record. The value is controlled only by Super Admin.

The API/config returned to Staff and Tablet must expose whether the enrollment gym supports Single Gym Pricing and, when selected, the appropriate published pricing catalogue.

New gyms default to disabled automatically. The rollout migration explicitly enables Neptunes.

## Enrollment Data
Membership applications must persist the chosen access mode and, for Single Gym, the target gym. This is captured at the start of the flow and carried through activation, printing, audit and renewal.

New membership activation writes the chosen access scope to the resulting member(s).

Renewal activation updates access scope only when the renewal becomes effective, preserving the existing renewal start/extension rules. Couples remain linked/atomic under the existing couples rules.

## Existing PR #78 Compatibility
PR #78 created `access_scope` with `network` / `neptunes_only` and enforced it in barcode, NFC and offline-roster paths. This feature must evolve that safely rather than layering a second access system on top.

During rollout:
- existing `neptunes_only` members become generic Single Gym members assigned to Neptunes;
- the behaviour before and after migration is equivalent for those members;
- network members remain network members;
- no active-gym scanner path may depend on a schema field before that schema is deployed.

## Offline Behaviour
Offline roster generation must remain gym-specific:
- a network member appears in every eligible gym roster as today;
- a Single Gym member appears only in the roster for their allowed gym;
- cached/offline behaviour must never broaden access because pricing/config is unavailable.

## Audit
Super Admin changes must be audited:
- enabling/disabling Single Gym Pricing for a gym;
- publishing/updating that gym's pricing catalogue.

Enrollment/renewal already-audited actions should include the selected access mode and target gym where applicable.

## Rollout and Safety
Because live gyms are actively testing the system:
1. Build on `feature/single-gym-pricing`; Production remains untouched during implementation.
2. Use TEST Supabase for schema/data/API verification first.
3. Add backward-compatible schema before deploying code that reads new fields.
4. Verify existing All Access enrollment, renewal, barcode scan, NFC scan, offline roster, couples and tablet paths as regression gates.
5. Verify generic Single Gym behaviour with fictional TEST records.
6. Migrate PR #78 Neptunes-only TEST data to the generic representation and prove identical access decisions.
7. Only after full CI/preview approval may Production schema be changed and code merged.
8. Production migration must be guarded/read-only counted first and must not alter unrelated members or pricing.

## Approaches Considered

### A. Neptunes-specific second pricing system
Fast initially, but duplicates pricing logic and requires new code for every future gym. Rejected.

### B. Separate per-gym pricing tables
Keeps data separated but duplicates schema and publishing logic and makes future gym provisioning cumbersome. Rejected.

### C. Existing pricing engine extended by scope + gym — selected
Reuse the current catalogue/version model and add gym/access dimensions. This keeps one pricing engine, one enrollment workflow and one set of validation rules while allowing every gym to have fully independent Single Gym prices.

## Acceptance Criteria
- Super Admin sees every gym automatically in Individual Gym Pricing.
- Neptunes starts enabled; other existing/new gyms default disabled.
- Every enabled gym can have a fully independent pricing matrix.
- Disabled gyms show no All Access/Single Gym choice and behave exactly as current All Access enrollment/renewal.
- Enabled gyms show **All Access** and **Single Gym** first on Staff and Tablet new enrollment and renewal.
- Renewals preselect current access mode and permit a deliberate change.
- All Access always uses the normal network catalogue.
- Single Gym uses only that gym's active price entries with no fallback.
- A Single Gym member can access only their assigned gym across barcode, NFC and offline paths.
- Existing Neptunes-only members retain identical effective access after conversion to the generic model.
- Existing network members, active gyms and unrelated operations remain unaffected.
