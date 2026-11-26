# Reception scanner QA — TEST only (26 November 2026)

Do not run fixture scans or edits in LIVE. Use the protected preview from this PR, verify its gym list includes inactive TEST-only Naxxar, sign in with existing TEST staff or Super Admin, select Marsa, and use the manual barcode dialog. Dismiss each result before proceeding. All SCANNER QA 261126 records are fictional and exist only in the TEST database.

## Phase A — read-only identity and access checks
| # | Enter | Expected |
|---|---|---|
| 1 | X9962601 | BGM26519, granted; do not show shadow BGM26521 |
| 2 | x9962601 | Same as #1 |
| 3 | X9962602 | BGM26520, granted via legacy Scan3 |
| 4 | x9962602 | Same as #3 |
| 5 | BGM26520 | Same member, current card display uses X9962602 from legacy |
| 6 | bgm26520 | Same as #5 |
| 7 | M9962602 | BGM26520, granted via original customer number |
| 8 | X9962603 | Disabled: old legacy card for modern owner A |
| 9 | X9962604 | BGM26522, expired, do not grant BGM26523 |
| 10 | X9962610 | Disabled: retired credential cannot fall through to legacy/old customer number |
| 11 | X9962613 | BGM26533, inactive/cancelled, no entry |
| 12 | BGM26534 | BGM26534 granted, no physical card displayed |
| 13 | M9962614 | BGM26534 via legacy customer ID |
| 14 | X9962699 | Not found |
| 15 | X9962601X9962602 | Not found; no new card assignment |
| 16 | X99626% | Not found; literal match, never a wildcard |
| 17 | X9962605 | Conflict F/G, no entry until identity confirmed |
| 18 | X9962606 | Conflict H/I, no entry until confirmed |
| 19 | X9962609 | Current physical card conflict J/K; no entry |
| 20 | X9962612 | Pending legacy candidate conflict N/O; no entry |

## Phase B — permanent ownership (writes to fictional TEST records)
| # | Action | Expected |
|---|---|---|
| 21 | X9962605, verify F BGM26524 | One tap saves current physical card, removes G claim; F granted |
| 22 | Rescan x9962605 in Marsa then Neptunes | F only, no conflict, no duplicate record in each gym's check-in window |
| 23 | Search G BGM26525 | G still exists, unchanged expiry, no access; only conflicting claim removed |
| 24 | X9962606, verify H BGM26526 at Marsa | Correct physical card saved, restricted-gym result, no check-in |
| 25 | Scan X9962606 at Neptunes | H only, access granted |
| 26 | X9962609, verify J BGM26528 | J retains physical card, K duplicate retired, both member accounts preserved |
| 27 | Scan lower/upper case X9962609 | J only; no fallback to K's legacy claim |
| 28 | X9962612, verify N BGM26531 | N current card saved, O marked not_owner, rescan N only |
| 29 | Open same conflict on two tabs before resolving | First save wins; second confirmation is rejected and asks for rescan |
| 30 | Try a changed candidate or stale scan | Rejected; no ownership changes |

Run the concurrency test on an unresolved fixture before performing its single-tab resolution. Do not run these destructive-to-fixture steps again until fixtures are reset. Never reset LIVE records.

## Phase C — scanner input, ordinary reception and database persistence
Use Playwright keyboard events (the existing browser test covers F9 prefix and a rapid keyboard burst), or the manual dialog in normal browser testing. Ordinary slow typing must not trigger a scan. Repeat in Home, Reception, Bar and Sundries while a form has unsaved text. Test two rapid inputs in sequence, dismiss both, and verify no lost scan or altered form text.
Test missing photo, active orange seven-day renewal notice, expired display, same member repeated within two hours, cross-gym visits, card replacement, card reservation/activation, deliberate release and reuse, case-only duplicate assignment rejection, concatenated barcode rejection, page reload and fresh browser tab. Use fictional accounts only.
After a card confirmation, reload and verify the current credential and audit entry in Super Admin. In two separate gym sessions rescan the same card. Compare scan logs and database credential history: a denied/ambiguous scan must not create a visit. If API or network fails, never display a successful save without server confirmation.
Disconnect the TEST browser only after saving a fresh offline roster. Check that the warning explicitly says offline/no live visit; shadowed and retired cards are absent and unresolved conflicts do not grant. Reconnect and verify fresh live lookup. Do not treat cached validity as authoritative live data.

## Phase D — data source and export
- The preview must use TEST, production must use LIVE. Runtime gym-list fingerprint: TEST has inactive Naxxar; LIVE does not. Do not read an import-preview table for access or saves.
- In Super Admin > Member import & export, verify Download full current members CSV downloads every TEST member including expired and archived records. Count rows against TEST database (not the displayed page), ensure BGM number and legacy number remain separate, verify all active/retired cards, membership category and duration/start/end, voucher terms, original and current dates, identity details, cancellation, access scope, and membership history. Missing historical terms are blank, not guessed.
- The full snapshot format BGM-current-v1 is not yet a safe re-import contract. The legacy importer must not accept it. Do not upload it until a dedicated round-trip preview/apply workflow is implemented and tested. A future importer must match immutable member IDs/BGM numbers, reject stale changes or foreign-environment files, apply only reviewed field-level edits, preserve membership relationships/payments/check-ins/photos/credentials/audit history, and never delete omitted rows.
- Test edited CSV against a fictional subset first, unchanged export must produce zero mutations, repeated import must be idempotent, and export after applying must reflect the precise approved edits only.

## Release gate
Latest CI unit/type/build and browser checks, DB transaction tests, verified isolated deployment, manual TEST workflow, current read-only LIVE impact audit, rollback plan. No production deploy or production data write without separate release approval. A physical reader test is still required when a reader becomes available.
