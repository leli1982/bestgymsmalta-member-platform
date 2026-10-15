# Phase B — BGM Member Number Renumbering Design

Date: 2026-10-07
Status: Design approved in chat; implementation not yet started
Repository: `leli1982/bestgymsmalta-member-platform`

## 1. Goal

Replace the current zero-padded permanent BGM member numbers with a simpler launch format beginning at `BGM1000`, while preserving every real member record and all UUID-based identity relationships.

The migration is TEST-first. No Production data, schema, or environment changes are permitted until TEST implementation, migration rehearsal, verification, and explicit Production approval are complete.

## 2. Permanent number format

The permanent public member number format becomes:

- Prefix: `BGM`
- Numeric portion: decimal integer, no leading zeros
- Minimum value: `1000`
- Variable width; no fixed number of digits

Examples:

- `BGM1000`
- `BGM9999`
- `BGM10000`
- `BGM250000`

Invalid examples:

- `BGM999`
- `BGM01000`
- `BGM0001000`

The application and database must no longer require exactly seven digits after `BGM`.

## 3. Existing member renumbering

All members are renumbered, including active, expired, inactive, archived, and otherwise non-current members.

Current TEST preflight snapshot:

- Member count: 25,511
- Current valid BGM numbers: 25,511
- Current duplicates: 0
- Current allocator last issued: 25,514
- Current range: `BGM0000001` through `BGM0025514`, with gaps

The new assignment is deterministic:

1. Sort members by the numeric value of the existing `member_number` ascending.
2. Use member UUID as a deterministic secondary sort key even though current BGM numbers are unique.
3. Assign sequential new numbers starting at `BGM1000`.
4. Do not preserve the old BGM number as an alias, lookup key, mapping table, or historical member identity.

With the approved current TEST snapshot:

- first assigned number: `BGM1000`
- last assigned number: `BGM26510`
- next allocator value after migration: `BGM26511`
- `BGM0000007` maps to `BGM1003`

Before execution, TEST must re-check the member count and the rank of `BGM0000007`. If the preflight state has drifted such that these expected results would change, stop and report the drift before applying the migration.

## 4. Identity model

The member UUID remains the canonical internal identity.

Renumbering changes only the public `member_number` value. The following relationships must remain attached to the same UUID and must not be regenerated from the new BGM number:

- `legacy_pk_customer` / pkCustomer
- Scan3 / physical-card barcode credentials
- original/legacy gym information
- official photos
- personal details
- membership status
- membership expiry
- membership ownership/link records
- app enrollment account state

BGM number, pkCustomer, and Scan3 remain separate identifiers linked through the member record. A BGM number must never be derived from pkCustomer or Scan3.

Existing shared/duplicate Scan3 conflict behaviour remains unchanged: scanning a duplicated physical-card value may resolve to multiple candidate members and staff can flag the conflict to Super Admin.

## 5. App login continuity

Member login continues to support the current BGM member number as a login identifier.

The renumbering does not change the member UUID, username, password hash, or app enrollment state.

The existing TEST app-enrolled account currently identified by `BGM0000007` remains enrolled and becomes `BGM1003` under the approved deterministic ordering. After migration, verification must confirm that `BGM1003` plus the existing password successfully authenticates the same member UUID.

The obsolete value `BGM0000007` must not remain a valid member-number login alias.

## 6. Physical card and barcode behaviour

Physical-card credentials are separate from `member_number` and must not be renumbered.

The migration must preserve:

- every `bgm_member_card_credentials.member_id`
- every active/reserved/retired physical barcode value
- current Scan3 associations
- card-conflict behaviour

The member app card endpoint currently treats the active physical-card barcode as the app barcode when present. Phase B does not change that behaviour.

Staff member-number search and scanning must accept the new variable-width BGM format.

## 7. Allocator design

`public.bgm_next_member_number()` must be changed from a seven-digit padded formatter to a variable-width formatter.

The allocator must:

- use the existing database counter/state table pattern
- store the numeric last-issued value as an integer/bigint
- start at or above 1000
- return `BGM` concatenated with the numeric value without padding
- remain server/service-role controlled
- continue atomically under concurrent allocation
- not reissue an already assigned number

After renumbering the approved TEST snapshot, `last_issued` must be `26510`, making the next allocation `BGM26511`.

## 8. Database validation and immutability

The current database rule requiring `^BGM[0-9]{7}$` must be replaced with a rule equivalent to:

- prefix is exactly `BGM`
- numeric portion contains decimal digits only
- numeric value is at least 1000
- canonical representation has no leading zero

The existing permanent-member-number immutability trigger currently blocks changing a valid assigned BGM number. The migration must use a controlled migration-only mechanism to perform the one-time renumbering, then restore/replace the guard so ordinary application code cannot arbitrarily alter an assigned BGM number afterward.

No ordinary API endpoint should gain a general-purpose member-number edit capability.

## 9. Atomic migration requirement

The TEST renumbering and related allocator/format changes must be applied as one controlled database migration/transaction wherever PostgreSQL permits.

The operation must fail closed. If any required step fails, the database must not be left with a partially renumbered member set.

At minimum the migration must verify before commit:

- every member has exactly one new number
- all new numbers are unique
- all new numbers are valid under the new format
- sequence begins at 1000
- assigned numeric values are continuous for the migration population
- no UUID changed
- no pkCustomer link changed
- no physical-card credential ownership changed
- allocator last-issued value equals the highest assigned number

## 10. Source/import provenance

Import/source history is retained because it contains useful provenance such as pkCustomer, Scan3/card information, source fingerprints, matched UUIDs, filenames, row numbers, and import decisions.

Obsolete old-format BGM-number snapshots have no launch value and should be removed from import/source fields where they represent the previous member-number system.

Known examples include fields such as:

- `bgm_member_import_rows.membership_number`
- `bgm_member_import_rows.resolved_membership_number`
- equivalent review/source snapshot fields that contain the old seven-digit BGM values

Implementation must inventory all such columns before writing cleanup SQL. Only obsolete BGM-number snapshots are removed; source provenance needed to explain pkCustomer/Scan3/member matching remains intact.

No old-to-new BGM alias table is created.

## 11. Test activity/statistics reset

The current app has not yet been used by real members. Existing operational statistics are development/test activity and can be reset for a clean launch baseline.

Clear disposable TEST operational history, including the applicable records in:

- access/check-in scan history
- member statistics derived from test scans
- test member notifications
- membership reminder history
- test password reset records
- test push-subscription records
- development/testing Super Admin and staff audit history
- other derived test counters/statistics discovered during implementation that do not contain source/member master data

Do not clear or alter:

- `bgm_members`
- member UUIDs
- personal/member master data
- membership status or expiry
- membership ownership/link records
- official photos
- pkCustomer
- original/legacy gym information
- physical-card/Scan3 credentials
- import/source provenance, except obsolete BGM-number snapshot fields as described above
- the existing app-enrolled TEST account credentials/state for the continuity test

Implementation must inventory the exact affected test-history tables and verify foreign-key dependencies before destructive cleanup.

## 12. Application code changes

Update all code that assumes exactly seven digits after `BGM`.

At minimum this includes:

- `lib/memberNumberCore.ts`
- member login validation/normalization
- member card validation
- staff/Super Admin member search parsing
- barcode/member-number scan routing
- enrollment/new-member allocation expectations
- import/export validation where member-number format is parsed
- tests and fixtures containing fixed-width BGM expectations

Do not change business behaviour unrelated to member-number formatting.

## 13. TEST-first verification

After applying the Phase B migration to TEST, verify all of the following before any Production discussion:

### Database invariants

- member count remains exactly the preflight count
- UUID set before and after is identical
- every member has a valid new BGM number
- numbers are unique
- new sequence is continuous from `BGM1000`
- highest assigned number matches allocator state
- old seven-digit BGM member numbers no longer exist in `bgm_members.member_number`
- obsolete old BGM snapshots are removed from approved import/source snapshot fields

### Relationship invariants

- pkCustomer values remain on the same UUIDs
- physical-card/Scan3 credentials remain on the same UUIDs
- official photo ownership remains unchanged
- membership link/ownership rows remain unchanged
- membership status and expiry remain unchanged

### Functional verification

- `BGM1003` authenticates the same member formerly identified as `BGM0000007`, using the existing password
- old `BGM0000007` does not authenticate as a member number
- Staff search finds members by new BGM number
- Super Admin search/edit views display new BGM numbers
- physical-card Scan3 scanning still resolves the correct member(s)
- duplicate/shared Scan3 conflict behaviour still works
- member app/card endpoint loads correctly
- exports show the new BGM numbers
- new enrollment allocates the next sequential BGM number
- a newly allocated number contains no leading zeros

## 14. Rollout boundary

Phase B implementation and database rehearsal occur on TEST only.

Production is not modified by approval of this design or by approval of the implementation plan. Production migration requires a separate explicit go-live approval after TEST verification is complete.

Before Production execution, repeat the same preflight inventory against Production and calculate its exact expected first/last/next numbers from the live member count at that time.

## 15. Non-goals

Phase B does not:

- create old-number aliases
- preserve the existing `BGM0000001` style values as identities
- derive BGM numbers from pkCustomer
- derive BGM numbers from Scan3
- change physical-card barcode values
- change membership pricing, expiry, status, couples logic, voucher logic, payroll, AI Trainer, Wallet, or member-access/grace-period behaviour
- normalize or merge members because of shared pkCustomer or shared Scan3 values

## 16. Success criteria

Phase B is successful on TEST when all members have a continuous new public identity beginning at `BGM1000`, the allocator continues from the highest assigned number, old BGM identities are gone, disposable test statistics are cleared, source provenance is retained, and every UUID-based pkCustomer/Scan3/photo/membership relationship remains intact.
