# Neptunes-only Membership Access Design

## Goal
Support memberships that are valid only at Neptunes Fitness while keeping pricing discounts/vouchers separate from access control.

## Rules
- Member access scope is explicit: `network` or `neptunes_only`.
- Existing members default to `network` unless deliberately migrated.
- Legacy real-import members whose `legacy_pk_customer` starts with `NO` are migrated to `neptunes_only`.
- The verified restricted gym is `bgm-neptunes` (Neptunes Fitness).
- A valid active `neptunes_only` member is granted at Neptunes and denied at every other gym with result `restricted_gym`.
- Expired/inactive/cancelled state remains more important than gym scope, so those members still show the existing expiry/inactive result.
- Online barcode, NFC and offline roster data must all carry/enforce the same scope.
- Shared-card conflict behaviour, photo warnings and canonical check-ins remain unchanged.
- Voucher code/percentage never determines access scope.

## Future memberships
- New memberships enrolled at Neptunes may explicitly select Neptunes-only access.
- Other gyms cannot create Neptunes-only memberships.
- Renewals preserve the existing member's access scope unless Super Admin deliberately changes it.

## Safety
- Do not change the historical legacy PK or legacy gym fields.
- Do not change membership expiry, status, card assignment, check-ins or prices while migrating access scope.
- Keep network access as the default for every non-matching member.