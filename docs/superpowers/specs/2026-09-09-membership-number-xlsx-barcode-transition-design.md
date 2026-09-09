# BestGymsMalta Membership Number, XLSX Transition & Barcode Access — Design

## Status

Approved design for Phase 2 on branch `phase-2-operations-nfc-redesign`.

This design supersedes the launch-time NFC access assumptions and the legacy destructive CSV member-sync behavior in the earlier Phase 2 design. Existing NFC schema/code may remain dormant for possible future use, but NFC is not part of the initial rollout.

## Goal

Create one permanent BestGymsMalta member identity that survives expiry and renewal, migrate the existing membership database safely from the current system, support a staged one-gym-at-a-time rollout, and use a phone-displayed barcode for reception check-in.

The design must support a transition period where one BGM gym uses the new platform while other gyms continue using the old membership system. During this period, current membership data will be exchanged through XLSX files.

## Permanent BGM Membership Number

Every person has one permanent BGM membership number for life.

Format:

`BGM0000001`

Rules:

- Prefix is exactly `BGM`.
- Numeric portion is exactly seven digits, zero-padded.
- Membership numbers are stored as text so leading zeroes are preserved.
- Numbers are globally unique across the entire BGM network.
- A number is never recycled or reassigned to another person.
- Expiry does not release the number.
- Renewal reuses the same number.
- The member barcode encodes the exact membership number.
- New numbers are allocated server-side / transaction-safely so concurrent enrollments cannot collide.
- The sequence continues upward and never searches for expired numbers to reuse.
- A draft/submitted application does not consume a permanent number. The number is allocated atomically when the new member identity is activated/committed. Once allocated, it is never returned to the pool, even if that membership later expires or the member is archived.
- A confirmed historical/bulk import allocates permanent numbers at import-apply time, not at preview time.

Example:

John Smith receives `BGM0000001`. His one-year membership expires. `BGM0000001` remains permanently reserved for John. If he returns years later, his renewal reactivates the same member identity and the same barcode.

## Person Identity vs Membership Period

The system distinguishes the person from the time-limited membership contract.

### Person

`bgm_members` is the permanent person/member identity and owns:

- permanent BGM membership number
- name and contact/profile data
- legacy old-system references
- app enrollment/login identity
- official member photo
- barcode identity
- permanent historical linkage to check-ins, progress, plans and other member data

### Membership Period

`bgm_memberships` stores renewable membership periods/contracts, including:

- membership type
- duration
- start date
- expiry date
- status
- payment/activation context
- joining/enrollment gym context
- staff attribution

A person may have multiple historical membership periods but only one BGM membership number.

## New Membership vs Renewal

The enrollment/reception workflow begins with two primary choices.

### New Membership

- Create a genuinely new enrollment/application.
- Capture required details and official photo.
- Create the first membership period/application data.
- When payment/activation commits the new person identity, generate the next permanent BGM membership number transaction-safely.
- From that point onward, the member owns that BGM number permanently.

### Renewal

- Search the existing BGM database first.
- Prefer membership number / barcode search.
- Fall back to name, mobile, email and legacy-reference search when needed.
- Staff confirms the correct person before renewal.
- Reuse the existing BGM membership number and barcode.
- Create a new membership period / renewal history entry.
- Never create a replacement member identity merely because the prior membership expired.

## Legacy `pkCustomer`

`pkCustomer` belongs to the old membership system and is not a globally unique BGM identity.

Rules:

- Preserve `pkCustomer` as a legacy reference.
- Do not use `pkCustomer` alone as the BGM member key.
- Imported legacy records retain their old-system context so duplicate PK values cannot merge unrelated people.
- The permanent BGM membership number becomes the primary identity once assigned.
- All new BGM operations use the BGM member ID / membership number, not `pkCustomer`.

Where needed during transition, legacy matching may use a composite of old-system context such as source gym plus `pkCustomer`, alongside other identifying fields. Ambiguous matches must be sent to review rather than guessed.

## Source Workbook

The received old-system workbook contains one member-data sheet with these 15 columns, in this order:

1. `Gym`
2. `pkCustomer`
3. `CustomerName`
4. `CompanyName`
5. `Address1`
6. `Address2`
7. `Town`
8. `PostCode`
9. `Gender`
10. `TelephoneNo1`
11. `TelephoneNo2`
12. `Mobile`
13. `Email`
14. `ExpiryDate1`
15. `ValidYN`

The importer must preserve these source values and tolerate legacy inconsistencies without silently merging or deleting members.

## BGM Transition Workbook

The BGM migration/exchange workbook adds one leading column:

1. `MembershipNumber`
2. `Gym`
3. `pkCustomer`
4. `CustomerName`
5. `CompanyName`
6. `Address1`
7. `Address2`
8. `Town`
9. `PostCode`
10. `Gender`
11. `TelephoneNo1`
12. `TelephoneNo2`
13. `Mobile`
14. `Email`
15. `ExpiryDate1`
16. `ValidYN`

This 16-column layout is the standard transition format used by BGM export and import.

## Initial Historical Numbering

On the controlled first import, all safely accepted historical people receive a permanent BGM membership number, including expired / not-valid historical members.

The initial allocation is deterministic in accepted workbook row order:

- first accepted imported person -> `BGM0000001`
- second accepted imported person -> `BGM0000002`
- and so on

Once assigned, the numbers are persisted permanently and are not regenerated by later exports/imports.

A source row is treated as a candidate person record, not blindly assumed unique. If the migration can safely identify two source records as the same already-known BGM person, they must not receive two permanent identities. If the source cannot safely establish whether a row is distinct or duplicated, the ambiguous row is held for review instead of consuming or overwriting another person's identity incorrectly.

## Pilot Rollout Strategy

The platform will initially run operationally in one gym while other gyms continue using the old system.

During this transition:

1. The pilot gym may create new members directly in BGM; BGM allocates permanent numbers when those new members are activated.
2. Other gyms continue creating/updating members in the old system.
3. A later current XLSX export from the old system is reconciled into the BGM transition workbook.
4. Existing rows keep their previously assigned `MembershipNumber` values.
5. New old-system rows may have blank `MembershipNumber` values.
6. On confirmed upload, BGM allocates safe next numbers for genuinely new blank-number rows at the exact import time.
7. This avoids collisions with numbers that may have been allocated by the pilot gym since the spreadsheet was downloaded.
8. Once every gym is using the new platform, XLSX/CSV import/export remains available as a controlled bulk-data and backup facility.

Manual pre-allocation of new numbers in Excel is not required and should not be the normal path. Blank new membership numbers are safer because the server allocates them against the current live sequence. If an uploaded row contains an explicit membership number, it must be validated strictly and must never overwrite or reassign another person's permanent number.

## Import Formats

Super Admin supports:

- Upload XLSX using the approved 16-column BGM transition layout.
- Upload CSV using the same 16 headers and field order.

The original 15-column old-system workbook is accepted only through the controlled initial/legacy migration flow where membership numbers have not yet been assigned. Normal ongoing transition imports use the 16-column BGM layout.

## Export Formats

Super Admin supports:

- Download XLSX — primary transition format.
- Download CSV — same 16 columns, same order.

The exported XLSX must preserve membership numbers as text, retain leading zeroes, use real date cells for expiry dates where possible, and be suitable for opening/editing/re-uploading in Excel.

CSV export preserves the exact membership-number text and the same header order.

## Import Safety Model

The existing destructive CSV sync behavior is retired.

Normal import is staged and non-destructive:

`Upload -> Parse -> Validate -> Match -> Preview -> Confirm -> Apply`

Before applying anything, Super Admin sees a summary such as:

- total rows read
- existing members matched
- unchanged rows
- rows to update
- new rows requiring BGM numbers
- conflicts / ambiguous rows
- invalid rows
- deletions: always zero for normal import

Rows omitted from an uploaded workbook are never automatically deleted, archived or deactivated.

Archiving/deactivation is a separate explicit privileged action.

## Matching Rules

Matching is conservative.

### 1. Membership number present

- `MembershipNumber` is the primary identity.
- If it exists and belongs to that member, update/reconcile that same person.
- If it belongs to another person or conflicts materially with the row, stop the row for review.
- An existing BGM number is never moved between people.

### 2. Membership number blank, legacy record already known

- Use stored legacy linkage/context and supporting identifying data to find the existing BGM member.
- Retain the member's existing BGM membership number.
- Never create a duplicate merely because the spreadsheet lacks the membership-number cell.

### 3. Membership number blank, genuinely new legacy record

- Mark as `New` in preview.
- Allocate the next permanent BGM number only when the confirmed import is applied.

### 4. Ambiguous match

- Do not guess.
- Mark as `Conflict` / `Needs review`.
- Do not modify existing member records until resolved.

## Field Preservation and Normalization

Import separates source preservation from internal normalized fields.

- Preserve source workbook values needed for faithful re-export/reconciliation.
- Normalize data internally for application use where appropriate.
- Gym spelling/casing variants may map to canonical BGM gym IDs for reporting, without overwriting the preserved source text unnecessarily.
- Dates are normalized internally while remaining exportable in the approved workbook format.
- Phone, mobile, postcode, email and other historically inconsistent values must not be silently moved between fields based only on guesswork.
- Formula cells from uploaded XLSX are treated as input values only after safe workbook parsing; formulas must not be executed by the server as arbitrary code.

## Barcode Access

NFC is deferred for initial rollout.

The member's permanent BGM membership number is encoded as a Code 128 barcode.

Example payload:

`BGM0001023`

### Member App

The virtual membership card displays:

- member name
- permanent BGM membership number
- membership status
- expiry date
- scannable Code 128 barcode

The existing NFC visual mark is replaced for launch with barcode-focused UI.

The barcode remains the same across renewals because it represents the permanent person identity, not a membership period.

### Reception

Preferred scanner hardware is a standard USB/Bluetooth barcode scanner operating in keyboard-emulation mode.

Flow:

`barcode -> membership number -> member -> current membership status -> access decision -> check-in`

The reception screen is optimized for immediate scanning and automatically returns to scan-ready state.

Granted scan:

- show official member photo when available
- full name
- membership number
- expiry
- large green `ACTIVE`
- success sound
- create canonical normal check-in

Expired/inactive scan:

- show identified member/photo when available
- large red `EXPIRED` / inactive status
- expiry/reason
- warning sound
- no granted check-in
- offer renewal/member actions according to permissions

Unknown barcode:

- clear `MEMBER NOT FOUND` state
- no check-in
- log attempt where appropriate

Barcode check-ins should use a source such as `barcode` so analytics can distinguish the access channel while still feeding the same canonical check-in history/passport system.

## NFC Future Compatibility

Do not delete the Phase 2 NFC database work solely because barcode is the initial rollout method.

- NFC tables/routes may remain dormant and inaccessible from normal launch UI.
- No NFC assignment is required during enrollment for launch.
- If NFC is introduced later, an NFC credential may point to the same permanent BGM member identity.
- Barcode and NFC can coexist later without changing permanent membership numbers.

## Enrollment UX Changes

The tablet/reception enrollment flow becomes:

1. Choose `NEW MEMBERSHIP` or `RENEWAL`.
2. For new: select membership type/duration and complete enrollment.
3. For renewal: find and verify the existing member first, then select the new membership period.
4. Capture/update official photo where required.
5. Complete printable membership form.
6. Submit for reception review.
7. Confirm payment / `PAYMENT RECEIVED — ACTIVATE`.
8. For a genuinely new member, activation atomically creates/commits the permanent person identity and allocates the next BGM number. A cancelled pre-activation application has no permanent member number to recycle.
9. Member can enroll in/login to the app and display the permanent barcode.

Printing never activates a membership.

No NFC-assignment step is required for initial rollout.

## Offline Emergency Roster

The existing offline-roster design remains compatible because it already uses permanent member number + full name.

The roster continues to contain only active members and only:

- membership number
- full name

Barcode support does not add photos/contact data to the offline emergency roster.

## Permissions

Existing member import/export permissions remain applicable. Super Admin is the primary operator for migration.

Normal gym accounts must not be able to perform bulk migration/import unless explicitly granted the relevant privileged permission.

Barcode reception uses the launch access permission in place of the NFC-specific UI. Existing NFC permission keys may remain for future use; a barcode-specific scan permission may be introduced rather than overloading `nfc.scan`.

## Audit Requirements

Audit bulk imports and meaningful identity changes.

For each confirmed import batch record:

- authenticated Super Admin/system account
- timestamp
- filename
- format (XLSX/CSV)
- row counts by outcome
- generated membership-number range/count
- conflicts
- import batch ID

Member-level audit should record permanent number assignment and critical identity/expiry changes without exposing secret credentials.

## Error Handling

- Reject files with missing/incorrect mandatory headers before mutation.
- Reject malformed membership-number formats.
- Reject duplicate membership numbers within the upload.
- Reject/review attempts to assign one membership number to different people.
- Do not partially guess through ambiguous legacy matches.
- Do not delete omitted members.
- Prefer an all-or-controlled-batch application strategy so a failed import cannot leave membership-number allocation half-applied without an auditable record.
- Surface row numbers and human-readable reasons for conflicts/errors.

## Testing Requirements

Implementation is test-first.

Minimum automated coverage:

- `BGM` + seven-digit formatting
- monotonic next-number allocation
- draft/cancelled application does not consume a permanent number
- expired number is never reusable by a different person
- renewal keeps the same membership number
- concurrent/new-number collision protection
- exact 16-column XLSX/CSV header contract
- initial 15-column legacy import path
- XLSX parsing of dates/text/blank fields
- CSV quoting/commas/newlines
- leading zero preservation
- explicit number conflict rejection
- blank new row receives a number only at apply time
- known legacy row with blank number keeps prior BGM number
- omitted rows cause zero deletions
- ambiguous legacy match stops for review
- export/import round trip for the transition format
- barcode payload equals exact membership number
- barcode access grants active member and denies expired/inactive member
- barcode check-in uses canonical check-in pipeline
- NFC remains dormant without breaking build/schema

Preview testing must include a controlled copy of the supplied workbook shape before any production migration.

## Deployment Safety

- Work only on `phase-2-operations-nfc-redesign`.
- Do not write directly to `main`.
- Database schema changes are authored as migrations and reviewed/tested before application.
- Normal import never deletes members.
- Production merge occurs only after Preview testing is explicitly accepted.
- The supplied real membership workbook is treated as sensitive operational data and is never committed to the public GitHub repository.

## Success Criteria

The design is successful when:

1. Every activated/imported person owns one permanent `BGM` + seven-digit membership number for life.
2. Expiry and renewal never transfer or regenerate that person's identity.
3. Historical old-system members are safely assigned permanent BGM identities.
4. The pilot gym can create members while other gyms remain on the old system without number collisions.
5. Super Admin can download and upload the standard XLSX transition workbook and equivalent CSV.
6. Imports are previewed, conservative and non-destructive.
7. The member app displays a reliable barcode based on the permanent membership number.
8. Reception can scan the phone barcode and obtain immediate active/expired access feedback plus canonical check-in behavior.
9. NFC can be added later without redesigning member identity.
