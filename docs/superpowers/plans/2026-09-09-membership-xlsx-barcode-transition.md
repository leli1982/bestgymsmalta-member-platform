# Membership XLSX & Barcode Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every person one permanent `BGM` + seven-digit membership number, safely migrate and round-trip the approved membership workbook through XLSX/CSV, show that permanent number as a Code 128 barcode in the member app, and use barcode scans for reception access/check-in while preserving NFC code for possible future use.

**Architecture:** `bgm_members` remains the permanent person identity. A transaction-safe database counter supplies numbers such as `BGM0000001` only when a person record is actually committed; membership periods remain separate in `bgm_memberships`. Bulk migration uses staged import batches/rows: parse and validate first, preview conservative matching, then apply in one database transaction with zero implicit deletions. XLSX/CSV use one 16-column exchange contract. Barcode reception looks up the permanent member number directly and feeds the existing canonical check-in history with `source='barcode'`.

**Tech Stack:** Next.js / React / TypeScript, Supabase/PostgreSQL, `exceljs` for XLSX parsing/writing, `jsbarcode` for Code 128 rendering, Node built-in test runner, existing Vercel Preview + GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-09-09-membership-number-xlsx-barcode-transition-design.md`

## Global Constraints

- Work only on `phase-2-operations-nfc-redesign`; never write directly to `main`.
- Production stays untouched until Preview testing is explicitly accepted.
- Membership number format is exactly `BGM` + seven digits, e.g. `BGM0000001`.
- A membership number belongs to one person for life and is never recycled after expiry.
- Draft/cancelled applications do not consume membership numbers.
- Renewal always reuses the existing person's membership number and barcode.
- `pkCustomer` is a legacy old-system reference only; it is never the BGM identity key.
- Normal imports are non-destructive. Omitted workbook rows cause zero deletions/archives/deactivations.
- Ongoing exchange format is exactly 16 columns: `MembershipNumber` followed by the supplied 15 legacy columns in their original order.
- The original 15-column workbook is accepted only through the controlled legacy/initial import path.
- Formula cells are never executed. Any formula in membership data is surfaced for review rather than silently trusting its calculated result.
- The supplied real workbook is sensitive operational data and must never be committed to the public repository.
- Existing member login, QR check-in, passport, stats, progress, trainer, story creator, announcements and other member features must keep working.
- NFC schema/code remains dormant and must not be deleted solely because launch access uses barcodes.
- Existing `bgm_members.status` and `bgm_members.membership_expiry` remain compatibility fields during migration.
- Historical data may contain blank or duplicate emails; the migration must not invent synthetic email addresses.

---

### Task 1: Add the permanent membership-number and import-staging schema

**Files:**
- Create: `supabase/migrations/20260909_140000_membership_identity_exchange.sql`
- Modify: `tests/phase2-schema-contract.test.mjs`
- Test: `tests/member-number-schema.test.mjs`

**Interfaces:**
- Produces: PostgreSQL function `public.bgm_next_member_number() returns text`.
- Produces: `bgm_members.member_number` defaulting to `bgm_next_member_number()` when omitted.
- Produces: legacy-shaped member columns used by import/export.
- Produces: `bgm_member_import_batches` and `bgm_member_import_rows` staging tables.
- Produces: generic barcode-capable fields on `bgm_access_scans`.
- Consumed by: Tasks 4–7 and 10–12.

- [ ] **Step 1: Write the failing schema-contract tests**

Add assertions that the new migration contains the permanent-number counter/function, nullable non-unique email migration, exact legacy fields, staging tables, and barcode access-scan fields:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260909_140000_membership_identity_exchange.sql",
    import.meta.url
  ),
  "utf8"
);

test("membership identity schema creates permanent BGM allocator", () => {
  assert.match(migration, /create table if not exists public\.bgm_member_number_state/i);
  assert.match(migration, /create or replace function public\.bgm_next_member_number/i);
  assert.match(migration, /BGM/i);
  assert.match(migration, /lpad/i);
});

test("legacy import can preserve blank or duplicate emails", () => {
  assert.match(migration, /alter column email drop not null/i);
  assert.match(migration, /drop constraint if exists bgm_members_email_key/i);
});

test("member import is staged before apply", () => {
  assert.match(migration, /bgm_member_import_batches/i);
  assert.match(migration, /bgm_member_import_rows/i);
  assert.match(migration, /row_number/i);
  assert.match(migration, /action/i);
});

test("access scan schema supports barcode credentials", () => {
  assert.match(migration, /credential_type/i);
  assert.match(migration, /credential_value/i);
  assert.match(migration, /barcode/i);
});
```

- [ ] **Step 2: Run the schema tests and verify RED**

Run:

```bash
node --experimental-strip-types --test tests/member-number-schema.test.mjs tests/phase2-schema-contract.test.mjs
```

Expected: FAIL because `20260909_140000_membership_identity_exchange.sql` does not yet exist / required contracts are absent.

- [ ] **Step 3: Write the migration**

Create the migration with these concrete structures:

```sql
create table if not exists public.bgm_member_number_state (
  id smallint primary key check (id = 1),
  last_issued bigint not null default 0 check (last_issued between 0 and 9999999),
  updated_at timestamptz not null default now()
);

insert into public.bgm_member_number_state (id, last_issued)
values (1, 0)
on conflict (id) do nothing;

-- Observe any already-correct permanent numbers without interpreting legacy 4-digit demo IDs.
update public.bgm_member_number_state
set last_issued = greatest(
  last_issued,
  coalesce((
    select max(substring(member_number from '^BGM([0-9]{7})$')::bigint)
    from public.bgm_members
    where member_number ~ '^BGM[0-9]{7}$'
  ), 0)
), updated_at = now()
where id = 1;

create or replace function public.bgm_next_member_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
begin
  update public.bgm_member_number_state
  set last_issued = last_issued + 1,
      updated_at = now()
  where id = 1
    and last_issued < 9999999
  returning last_issued into next_value;

  if next_value is null then
    raise exception 'BGM membership number range exhausted';
  end if;

  return 'BGM' || lpad(next_value::text, 7, '0');
end;
$$;

alter table public.bgm_members
  alter column member_number set default public.bgm_next_member_number(),
  alter column email drop not null,
  add column if not exists legacy_gym text,
  add column if not exists legacy_pk_customer text,
  add column if not exists company_name text,
  add column if not exists town text,
  add column if not exists gender text,
  add column if not exists telephone_no_1 text,
  add column if not exists telephone_no_2 text,
  add column if not exists mobile text;

alter table public.bgm_members
  drop constraint if exists bgm_members_email_key;

create index if not exists bgm_members_email_lower_idx
  on public.bgm_members (lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists bgm_members_legacy_pk_idx
  on public.bgm_members (legacy_pk_customer);
create index if not exists bgm_members_legacy_gym_pk_idx
  on public.bgm_members (lower(legacy_gym), legacy_pk_customer)
  where legacy_gym is not null and legacy_pk_customer is not null;

create table if not exists public.bgm_member_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by_system_user_id uuid not null references public.bgm_system_users(id) on delete restrict,
  filename text not null,
  file_format text not null check (file_format in ('xlsx', 'csv')),
  import_mode text not null check (import_mode in ('legacy_15', 'exchange_16')),
  status text not null default 'preview' check (status in ('preview', 'applied', 'cancelled', 'failed')),
  total_rows integer not null default 0,
  new_rows integer not null default 0,
  update_rows integer not null default 0,
  unchanged_rows integer not null default 0,
  conflict_rows integer not null default 0,
  invalid_rows integer not null default 0,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bgm_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bgm_member_import_batches(id) on delete cascade,
  row_number integer not null,
  membership_number text,
  gym text,
  pk_customer text,
  customer_name text,
  company_name text,
  address1 text,
  address2 text,
  town text,
  postcode text,
  gender text,
  telephone_no_1 text,
  telephone_no_2 text,
  mobile text,
  email text,
  expiry_date date,
  valid_yn text,
  source_fingerprint text not null,
  action text not null check (action in ('new', 'update', 'unchanged', 'conflict', 'invalid')),
  matched_member_id uuid references public.bgm_members(id) on delete set null,
  issue text,
  resolved_membership_number text,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index if not exists bgm_member_import_rows_batch_action_idx
  on public.bgm_member_import_rows (batch_id, action);

alter table public.bgm_access_scans
  add column if not exists credential_type text not null default 'nfc',
  add column if not exists credential_value text;

update public.bgm_access_scans
set credential_value = card_uid
where credential_value is null and card_uid is not null;

alter table public.bgm_access_scans
  alter column card_uid drop not null;

alter table public.bgm_member_number_state enable row level security;
alter table public.bgm_member_import_batches enable row level security;
alter table public.bgm_member_import_rows enable row level security;
```

Also replace the existing `bgm_access_scans.result` check constraint with one that accepts the existing NFC results plus `unknown_member` and `invalid_barcode`, and constrain `credential_type` to `nfc`/`barcode`.

- [ ] **Step 4: Run schema tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test tests/member-number-schema.test.mjs tests/phase2-schema-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Apply the migration to the current development Supabase only after reviewing SQL**

Use the Supabase migration mechanism; do not run DDL through ad-hoc `execute_sql`. Verify afterward:

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'bgm_members'
order by ordinal_position;

select * from public.bgm_member_number_state;
```

Expected: `email` nullable; counter present; existing demo members unchanged.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260909_140000_membership_identity_exchange.sql tests/member-number-schema.test.mjs tests/phase2-schema-contract.test.mjs
git commit -m "feat: add permanent membership identity schema"
```

---

### Task 2: Implement pure membership-number and exchange-format contracts

**Files:**
- Create: `lib/memberNumberCore.ts`
- Create: `lib/memberExchangeCore.ts`
- Test: `tests/member-number-core.test.mjs`
- Test: `tests/member-exchange-core.test.mjs`

**Interfaces:**
- Produces: `formatMembershipNumber(value: number): string`.
- Produces: `parseMembershipNumber(value: unknown): number | null`.
- Produces: `normalizeMembershipNumber(value: unknown): string`.
- Produces: `LEGACY_MEMBER_HEADERS`, `MEMBER_EXCHANGE_HEADERS`.
- Produces: `normalizeLegacyValidity(value)` and `statusFromLegacy(validYN, expiryDate, today)`.
- Consumed by: import parser, matching, export, barcode route and tests.

- [ ] **Step 1: Write failing membership-number tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMembershipNumber,
  normalizeMembershipNumber,
  parseMembershipNumber,
} from "../lib/memberNumberCore.ts";

test("formats BGM plus exactly seven digits", () => {
  assert.equal(formatMembershipNumber(1), "BGM0000001");
  assert.equal(formatMembershipNumber(25418), "BGM0025418");
  assert.equal(formatMembershipNumber(9999999), "BGM9999999");
});

test("rejects malformed or out-of-range permanent numbers", () => {
  assert.equal(parseMembershipNumber("BGM0000001"), 1);
  assert.equal(parseMembershipNumber("BGM001"), null);
  assert.equal(parseMembershipNumber("0000001"), null);
  assert.equal(parseMembershipNumber("BGM10000000"), null);
});

test("normalization uppercases but never invents missing digits", () => {
  assert.equal(normalizeMembershipNumber(" bgm0000042 "), "BGM0000042");
  assert.equal(normalizeMembershipNumber("42"), "42");
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/member-number-core.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `lib/memberNumberCore.ts`**

```ts
export const MEMBERSHIP_NUMBER_PATTERN = /^BGM(\d{7})$/;

export function formatMembershipNumber(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 9_999_999) {
    throw new Error("Membership number must be between 1 and 9999999.");
  }
  return `BGM${String(value).padStart(7, "0")}`;
}

export function normalizeMembershipNumber(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function parseMembershipNumber(value: unknown) {
  const normalized = normalizeMembershipNumber(value);
  const match = normalized.match(MEMBERSHIP_NUMBER_PATTERN);
  if (!match) return null;
  const parsed = Number(match[1]);
  return parsed >= 1 && parsed <= 9_999_999 ? parsed : null;
}
```

- [ ] **Step 4: Write the failing exchange-header tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_MEMBER_HEADERS,
  MEMBER_EXCHANGE_HEADERS,
} from "../lib/memberExchangeCore.ts";

test("legacy format is exactly the supplied 15 columns", () => {
  assert.deepEqual(LEGACY_MEMBER_HEADERS, [
    "Gym", "pkCustomer", "CustomerName", "CompanyName", "Address1",
    "Address2", "Town", "PostCode", "Gender", "TelephoneNo1",
    "TelephoneNo2", "Mobile", "Email", "ExpiryDate1", "ValidYN",
  ]);
});

test("exchange format prepends MembershipNumber and changes nothing else", () => {
  assert.deepEqual(MEMBER_EXCHANGE_HEADERS, [
    "MembershipNumber", ...LEGACY_MEMBER_HEADERS,
  ]);
});
```

- [ ] **Step 5: Implement the exchange constants and status helpers**

```ts
export const LEGACY_MEMBER_HEADERS = [
  "Gym", "pkCustomer", "CustomerName", "CompanyName", "Address1",
  "Address2", "Town", "PostCode", "Gender", "TelephoneNo1",
  "TelephoneNo2", "Mobile", "Email", "ExpiryDate1", "ValidYN",
] as const;

export const MEMBER_EXCHANGE_HEADERS = [
  "MembershipNumber",
  ...LEGACY_MEMBER_HEADERS,
] as const;

export function normalizeLegacyValidity(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "valid") return "Valid";
  if (text === "not valid") return "Not Valid";
  return "";
}

export function statusFromLegacy(validYN: unknown) {
  return normalizeLegacyValidity(validYN) === "Valid" ? "active" : "inactive";
}
```

- [ ] **Step 6: Run both tests and verify GREEN**

```bash
node --experimental-strip-types --test tests/member-number-core.test.mjs tests/member-exchange-core.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/memberNumberCore.ts lib/memberExchangeCore.ts tests/member-number-core.test.mjs tests/member-exchange-core.test.mjs
git commit -m "feat: define membership exchange contract"
```

---

### Task 3: Add safe CSV and XLSX parsing/writing

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/memberExchangeCsv.ts`
- Create: `lib/memberExchangeWorkbook.ts`
- Test: `tests/member-exchange-csv.test.mjs`
- Test: `tests/member-exchange-workbook.test.mjs`

**Interfaces:**
- Produces: `parseMemberExchangeCsv(text: string): ParsedMemberExchangeFile`.
- Produces: `serializeMemberExchangeCsv(rows): string`.
- Produces: `parseMemberExchangeXlsx(buffer: Buffer): Promise<ParsedMemberExchangeFile>`.
- Produces: `buildMemberExchangeXlsx(rows): Promise<Buffer>`.
- `ParsedMemberExchangeFile` includes `mode`, `headers`, `rows`, and formula-cell issues.
- Consumed by: Task 5 preview endpoint and Task 7 export endpoint.

- [ ] **Step 1: Install ExcelJS**

Run:

```bash
npm install exceljs
```

Do not add a second XLSX library.

- [ ] **Step 2: Write failing CSV round-trip tests**

Include commas, quotes, embedded newline, blank fields and exact header order:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMemberExchangeCsv,
  serializeMemberExchangeCsv,
} from "../lib/memberExchangeCsv.ts";

test("CSV round trip preserves exact 16-column values", () => {
  const csv = [
    "MembershipNumber,Gym,pkCustomer,CustomerName,CompanyName,Address1,Address2,Town,PostCode,Gender,TelephoneNo1,TelephoneNo2,Mobile,Email,ExpiryDate1,ValidYN",
    'BGM0000001,QROQQ,123,"Borg, John",,"1 Main St",,Naxxar,NXR1234,M,,99112233,,john@example.com,03/09/2027,Valid',
  ].join("\n");
  const parsed = parseMemberExchangeCsv(csv);
  assert.equal(parsed.mode, "exchange_16");
  assert.equal(parsed.rows[0].values.CustomerName, "Borg, John");
  assert.equal(parseMemberExchangeCsv(serializeMemberExchangeCsv(parsed.rows)).rows[0].values.CustomerName, "Borg, John");
});
```

- [ ] **Step 3: Implement RFC-4180-style CSV parsing/serialization**

Do not reuse the old line-splitting parser because embedded newlines inside quoted cells must work. Implement a character-state parser that tracks quoted fields across line breaks and returns row numbers for error reporting.

- [ ] **Step 4: Run CSV tests and verify GREEN**

```bash
node --experimental-strip-types --test tests/member-exchange-csv.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Write failing XLSX tests**

Build synthetic ExcelJS workbooks in-memory. Test:

```js
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import test from "node:test";
import { parseMemberExchangeXlsx } from "../lib/memberExchangeWorkbook.ts";

test("XLSX recognizes the 15-column legacy contract", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow([
    "Gym", "pkCustomer", "CustomerName", "CompanyName", "Address1",
    "Address2", "Town", "PostCode", "Gender", "TelephoneNo1",
    "TelephoneNo2", "Mobile", "Email", "ExpiryDate1", "ValidYN",
  ]);
  sheet.addRow(["QROQQ", "100", "John Borg", "", "", "", "", "", "", "", "99112233", "", "", new Date("2027-09-03T00:00:00Z"), "Valid"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await parseMemberExchangeXlsx(buffer);
  assert.equal(parsed.mode, "legacy_15");
  assert.equal(parsed.rows.length, 1);
});

test("formula cells are flagged instead of executed", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow([
    "MembershipNumber", "Gym", "pkCustomer", "CustomerName", "CompanyName",
    "Address1", "Address2", "Town", "PostCode", "Gender", "TelephoneNo1",
    "TelephoneNo2", "Mobile", "Email", "ExpiryDate1", "ValidYN",
  ]);
  const row = sheet.addRow(["", "QROQQ", "100", "John Borg", "", "", "", "", "", "", "", "", "", "", "", "Valid"]);
  row.getCell(12).value = { formula: "1804-366-8555", result: -7117 };
  const parsed = await parseMemberExchangeXlsx(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.rows[0].issues[0].kind, "formula_cell");
});
```

- [ ] **Step 6: Implement ExcelJS parser/writer**

Key implementation rules:

```ts
function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value && typeof value === "object" && "formula" in value) {
    return {
      value: "",
      issue: {
        kind: "formula_cell" as const,
        column: String(cell.col),
        formula: String(value.formula || ""),
        cachedResult: value.result == null ? "" : String(value.result),
      },
    };
  }
  if (value instanceof Date) return { value, issue: null };
  return { value: value == null ? "" : String(value), issue: null };
}
```

Use the first worksheet only after verifying its header row is exactly either the 15-column or 16-column contract. Date parsing must accept real `Date` cells, Excel serial numbers, `dd/mm/yyyy`, and ISO date strings. The writer must set column 1 (`MembershipNumber`) number format to text (`@`) and write `ExpiryDate1` as a real Date cell with `dd/mm/yyyy` formatting when a date exists.

- [ ] **Step 7: Run workbook tests and verify GREEN**

```bash
node --experimental-strip-types --test tests/member-exchange-workbook.test.mjs tests/member-exchange-csv.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/memberExchangeCsv.ts lib/memberExchangeWorkbook.ts tests/member-exchange-csv.test.mjs tests/member-exchange-workbook.test.mjs
git commit -m "feat: parse and write membership XLSX CSV"
```

---

### Task 4: Implement conservative matching and preview classification

**Files:**
- Create: `lib/memberImportMatchCore.ts`
- Test: `tests/member-import-match-core.test.mjs`

**Interfaces:**
- Consumes: normalized exchange row plus candidate existing members.
- Produces: `classifyMemberImportRow(input): { action, matchedMemberId, issue }`.
- Actions: `new | update | unchanged | conflict | invalid`.
- Consumed by: Task 5 preview API.

- [ ] **Step 1: Write failing matching tests**

Cover the exact decision ladder:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { classifyMemberImportRow } from "../lib/memberImportMatchCore.ts";

test("explicit permanent number wins when it belongs to that member", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "BGM0000042", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byMembershipNumber: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("explicit number attached to materially different person is conflict", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "BGM0000042", gym: "Marsa", pkCustomer: "999", customerName: "Mary Vella", email: "mary@example.com" },
    byMembershipNumber: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "conflict");
});

test("blank number with one strong legacy match keeps existing member", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byMembershipNumber: [],
    legacyCandidates: [{ id: "m1", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("ambiguous duplicate legacy key is conflict rather than guessed", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "" },
    byMembershipNumber: [],
    legacyCandidates: [
      { id: "m1", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "" },
      { id: "m2", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "" },
    ],
  });
  assert.equal(result.action, "conflict");
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/member-import-match-core.test.mjs
```

Expected: FAIL because the matcher does not exist.

- [ ] **Step 3: Implement matcher with conservative evidence rules**

Use exact permanent-number matching first. With blank number, consider stored legacy gym + PK candidates; if more than one candidate exists, require supporting fields (normalized name and/or nonblank email) to reduce to exactly one. If evidence remains ambiguous, return `conflict`. No fuzzy-name matching, edit distance, or guessed phone-field movement.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
node --experimental-strip-types --test tests/member-import-match-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/memberImportMatchCore.ts tests/member-import-match-core.test.mjs
git commit -m "feat: classify membership import rows safely"
```

---

### Task 5: Replace destructive import with staged preview

**Files:**
- Delete/replace behavior in: `app/api/admin/members/import/route.ts`
- Create: `app/api/admin/members/import/preview/route.ts`
- Create: `app/api/admin/members/import/batches/[batchId]/route.ts`
- Create: `lib/memberImportServer.ts`
- Test: `tests/member-import-safety.test.mjs`

**Interfaces:**
- `POST /api/admin/members/import/preview` multipart `{ file }` -> preview summary + `batchId`.
- `GET /api/admin/members/import/batches/:batchId` -> batch summary + conflict/invalid rows.
- Requires `members.import` system permission (Super Admin bypass).
- Produces staged rows for Task 6 apply route.

- [ ] **Step 1: Add a new privileged permission in a failing test**

Update `tests/system-permissions.test.mjs` to expect:

```js
assert.ok(SYSTEM_PERMISSION_KEYS.includes("members.import"));
```

Also add `barcode.scan` now so the later reception task does not overload `nfc.scan`.

- [ ] **Step 2: Update permission definitions and admin labels**

Modify:

- `lib/systemPermissions.ts`
- `components/admin/SystemUsersAdmin.tsx`

Add labels:

```ts
"members.import": "Import membership data",
"barcode.scan": "Use barcode reception scanner",
```

Default new gym accounts should include `barcode.scan`; leave NFC permissions available but do not require them for launch.

- [ ] **Step 3: Write the import-safety test**

The test must statically reject the old destructive pattern:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  new URL("../app/api/admin/members/import/preview/route.ts", import.meta.url),
  "utf8"
);

test("preview import never deletes omitted members", () => {
  assert.doesNotMatch(route, /\.from\(["']bgm_members["']\)\s*\.delete\(/s);
  assert.doesNotMatch(route, /membersToDelete|idsToDelete/);
});
```

- [ ] **Step 4: Implement preview server flow**

`lib/memberImportServer.ts` should:

1. Parse the file using Task 3.
2. Reject wrong headers before creating any mutations to members.
3. Create a `bgm_member_import_batches` row.
4. Fetch only member fields needed for matching: `id, member_number, full_name, email, legacy_gym, legacy_pk_customer, membership_expiry, status`.
5. Classify each uploaded row with Task 4.
6. Convert formula-cell rows to `invalid` with a precise issue such as `Formula found in TelephoneNo2; replace it with literal text before import.`
7. Insert staging rows in chunks (e.g. 500 rows per insert) to avoid request-size spikes.
8. Update batch counts.
9. Return counts and at most the first 100 conflict/invalid rows; never echo the full 25k-member dataset to the browser.

For `legacy_15` mode, blank membership numbers are normal. For `exchange_16`, malformed nonblank permanent numbers are `invalid`.

- [ ] **Step 5: Retire the old destructive route**

Make `app/api/admin/members/import/route.ts` either delegate to the new preview handler or return a clear 410/400 explaining that direct CSV sync is retired. It must contain no member-deletion logic.

- [ ] **Step 6: Run tests**

```bash
node --experimental-strip-types --test tests/system-permissions.test.mjs tests/member-import-safety.test.mjs tests/member-import-match-core.test.mjs tests/member-exchange-*.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/systemPermissions.ts components/admin/SystemUsersAdmin.tsx lib/memberImportServer.ts app/api/admin/members/import tests/system-permissions.test.mjs tests/member-import-safety.test.mjs
git commit -m "feat: preview membership imports without deletion"
```

---

### Task 6: Apply confirmed import atomically and allocate permanent numbers

**Files:**
- Create: `supabase/migrations/20260909_143000_apply_member_import_batch.sql`
- Create: `app/api/admin/members/import/apply/route.ts`
- Test: `tests/member-import-apply-schema.test.mjs`

**Interfaces:**
- Produces RPC `public.bgm_apply_member_import_batch(p_batch_id uuid, p_system_user_id uuid)`.
- `POST /api/admin/members/import/apply` body `{ batchId }` -> applied counts and generated range/count.
- Consumes staging tables from Task 1 and preview rows from Task 5.

- [ ] **Step 1: Write failing RPC contract tests**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(
  new URL("../supabase/migrations/20260909_143000_apply_member_import_batch.sql", import.meta.url),
  "utf8"
);

test("apply rejects batches with unresolved rows", () => {
  assert.match(sql, /conflict/i);
  assert.match(sql, /invalid/i);
  assert.match(sql, /raise exception/i);
});

test("apply processes rows in workbook order", () => {
  assert.match(sql, /order by row_number/i);
});

test("apply never deletes members", () => {
  assert.doesNotMatch(sql, /delete\s+from\s+public\.bgm_members/i);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/member-import-apply-schema.test.mjs
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement transactional apply RPC**

The PL/pgSQL function must:

- `SELECT ... FOR UPDATE` the batch row and require `status='preview'`.
- Refuse apply when `conflict_rows > 0 OR invalid_rows > 0`.
- Loop staged rows `ORDER BY row_number`.
- `unchanged`: no member mutation.
- `update`: update only profile/legacy compatibility fields; preserve `username`, `password_hash`, `app_enrolled`, `created_at`, member `id`, and permanent `member_number`.
- `new` with blank `membership_number`: insert `bgm_members` while omitting `member_number`, allowing the Task 1 default function to allocate it transactionally.
- `new` with explicit membership number: validate `^BGM[0-9]{7}$`, reject if already owned, insert it, and advance `bgm_member_number_state.last_issued` to at least that numeric suffix inside the same transaction.
- Map `CustomerName` to `full_name`, falling back to `CompanyName` only when `CustomerName` is blank; never fabricate a fake name.
- Map source fields directly to their matching legacy/canonical columns; do not guess that `Mobile` is a phone or ID field.
- Set compatibility `status` from `ValidYN`; set `membership_expiry` from `ExpiryDate1`.
- Record each resolved number back to `bgm_member_import_rows.resolved_membership_number`.
- Update batch `status='applied'`, `applied_at=now()`.
- Add one audit row with `action_key='members.import.applied'`, `entity_type='member_import_batch'`, `entity_id=batch_id::text`, and counts in `after_data`.

Because the counter update and member inserts occur inside this RPC transaction, a thrown error rolls back the member changes and counter increment together.

- [ ] **Step 4: Implement apply API route**

Use `requireSystemPermission(request, "members.import")`, confirm the authenticated system user ID, call the RPC once, and return the RPC result. Do not accept a membership-number range from the browser.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
node --experimental-strip-types --test tests/member-import-apply-schema.test.mjs tests/member-import-safety.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Apply migration to development Supabase and run a synthetic three-row transaction test**

Use only synthetic members. Verify:

- two new blank-number rows receive sequential permanent numbers;
- one update keeps its old number;
- rerunning an already-applied batch is rejected;
- no row outside the batch is deleted.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260909_143000_apply_member_import_batch.sql app/api/admin/members/import/apply/route.ts tests/member-import-apply-schema.test.mjs
git commit -m "feat: apply membership imports transactionally"
```

---

### Task 7: Replace export with the exact 16-column XLSX/CSV exchange format

**Files:**
- Modify: `app/api/admin/members/export/route.ts`
- Test: `tests/member-export-contract.test.mjs`

**Interfaces:**
- `GET /api/admin/members/export?format=xlsx` -> XLSX.
- `GET /api/admin/members/export?format=csv` -> CSV.
- Both use the exact 16 headers and order from Task 2.
- Requires `members.export` system permission (Super Admin bypass).

- [ ] **Step 1: Write failing export-contract test**

Require the route to consume `MEMBER_EXCHANGE_HEADERS` and support both formats:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../app/api/admin/members/export/route.ts", import.meta.url),
  "utf8"
);

test("membership export supports XLSX and CSV exchange formats", () => {
  assert.match(source, /MEMBER_EXCHANGE_HEADERS/);
  assert.match(source, /format.*xlsx/s);
  assert.match(source, /format.*csv/s);
  assert.doesNotMatch(source, /memberNumber,fullName,email,phone,status/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/member-export-contract.test.mjs
```

Expected: FAIL against the current 13-column export.

- [ ] **Step 3: Implement exchange-row projection**

Select:

```ts
"member_number, legacy_gym, legacy_pk_customer, full_name, company_name, address_line_1, address_line_2, town, postcode, gender, telephone_no_1, telephone_no_2, mobile, email, membership_expiry, status"
```

Project each row as:

```ts
{
  MembershipNumber: member.member_number,
  Gym: member.legacy_gym || "",
  pkCustomer: member.legacy_pk_customer || "",
  CustomerName: member.full_name || "",
  CompanyName: member.company_name || "",
  Address1: member.address_line_1 || "",
  Address2: member.address_line_2 || "",
  Town: member.town || "",
  PostCode: member.postcode || "",
  Gender: member.gender || "",
  TelephoneNo1: member.telephone_no_1 || "",
  TelephoneNo2: member.telephone_no_2 || "",
  Mobile: member.mobile || "",
  Email: member.email || "",
  ExpiryDate1: member.membership_expiry || "",
  ValidYN: member.status === "active" ? "Valid" : "Not Valid",
}
```

Use Task 3 writer for XLSX and CSV serializer for CSV. Add `Cache-Control: no-store` and suitable content-disposition filenames.

- [ ] **Step 4: Run export and exchange round-trip tests**

```bash
node --experimental-strip-types --test tests/member-export-contract.test.mjs tests/member-exchange-*.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/members/export/route.ts tests/member-export-contract.test.mjs
git commit -m "feat: export membership exchange XLSX and CSV"
```

---

### Task 8: Build the Super Admin Membership Data preview/apply UI

**Files:**
- Create: `components/admin/MembershipDataAdmin.tsx`
- Modify: `components/admin/MembersAdmin.tsx`
- Test: `tests/membership-data-admin-contract.test.mjs`

**Interfaces:**
- Uploads `.xlsx` or `.csv` to preview endpoint.
- Shows counts: total, matched/updates, unchanged, new, conflicts, invalid, deletions=0.
- Applies only after explicit `Confirm Import`.
- Downloads XLSX and CSV through Task 7.

- [ ] **Step 1: Write a failing UI contract test**

Assert the new component contains the safe labels and no destructive copy:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../components/admin/MembershipDataAdmin.tsx", import.meta.url),
  "utf8"
);

test("membership data UI makes import preview explicit", () => {
  assert.match(source, /Download XLSX/);
  assert.match(source, /Download CSV/);
  assert.match(source, /Preview Import/);
  assert.match(source, /Confirm Import/);
  assert.match(source, /Deletions/);
  assert.doesNotMatch(source, /Members not included.*removed/i);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/membership-data-admin-contract.test.mjs
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `MembershipDataAdmin`**

Use a clear three-state UI:

1. **Choose file** — accepts `.xlsx,.csv`.
2. **Preview** — summary cards and conflict/invalid row table with row number/reason.
3. **Confirm** — enabled only when `conflicts===0 && invalid===0`; after apply show imported/updated counts and generated number count.

The component must not parse the workbook client-side; the server is authoritative.

- [ ] **Step 4: Replace the old CSV block in `MembersAdmin.tsx`**

Remove `downloadMembersTemplate`, `importMembersCsv`, `exportMembersCsv`, destructive import summary copy, and old file input. Render:

```tsx
<MembershipDataAdmin onApplied={loadMembers} />
```

Do not refactor unrelated member-list/editor code in the same task.

- [ ] **Step 5: Run tests/typecheck**

```bash
node --experimental-strip-types --test tests/membership-data-admin-contract.test.mjs
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/MembershipDataAdmin.tsx components/admin/MembersAdmin.tsx tests/membership-data-admin-contract.test.mjs
git commit -m "feat: add safe membership data import preview UI"
```

---

### Task 9: Make member authentication compatible with blank/duplicate contact emails

**Files:**
- Modify: `app/api/member/auth/forgot-password/route.ts`
- Modify: `components/member-auth/MemberLoginPage.tsx`
- Modify: `app/api/admin/members/route.ts`
- Test: `tests/member-email-identity-contract.test.mjs`

**Interfaces:**
- App activation remains `member number + email + chosen username + password`.
- Password reset becomes `member number + email`, avoiding ambiguous email-only lookup.
- Admin/new-member creation may omit `memberNumber`; the DB default allocates it.

- [ ] **Step 1: Write failing contract tests**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const forgot = fs.readFileSync(new URL("../app/api/member/auth/forgot-password/route.ts", import.meta.url), "utf8");
const adminMembers = fs.readFileSync(new URL("../app/api/admin/members/route.ts", import.meta.url), "utf8");

test("password reset scopes duplicate email by member number", () => {
  assert.match(forgot, /memberNumber/);
  assert.match(forgot, /\.eq\(["']member_number["']/);
  assert.match(forgot, /\.eq\(["']email["']/);
});

test("new member creation can use database-generated membership number", () => {
  assert.doesNotMatch(adminMembers, /Member number is required/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/member-email-identity-contract.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Update forgot-password flow**

Read both:

```ts
const memberNumber = normalizeMembershipNumber(body.memberNumber);
const email = String(body.email || "").trim().toLowerCase();
```

Query:

```ts
.eq("member_number", memberNumber)
.eq("email", email)
.maybeSingle()
```

Keep the generic success response to avoid account enumeration.

- [ ] **Step 4: Update member-login/reset UI**

Where the forgot-password form currently requests only email, add a membership-number field labelled `Membership Number` with placeholder `BGM0000001`. Submit both values.

- [ ] **Step 5: Make admin create use the DB allocator**

For `mode === "create"`, omit `member_number` from the insert payload when no valid explicit permanent number is supplied. Return the generated number from `.select("*").single()`. For normal interactive creation, do not let the browser calculate the next number.

- [ ] **Step 6: Run tests/typecheck**

```bash
node --experimental-strip-types --test tests/member-email-identity-contract.test.mjs tests/member-server-session.test.mjs tests/member-client-session.test.mjs
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/member/auth/forgot-password/route.ts components/member-auth/MemberLoginPage.tsx app/api/admin/members/route.ts tests/member-email-identity-contract.test.mjs
git commit -m "fix: support legacy duplicate membership emails"
```

---

### Task 10: Add the permanent Code 128 barcode to the virtual member card

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/member/MemberBarcode.tsx`
- Modify: `components/member/MemberCard.tsx`
- Test: `tests/member-barcode-contract.test.mjs`

**Interfaces:**
- `MemberBarcode({ memberNumber }: { memberNumber: string })` renders a Code 128 SVG.
- Barcode payload is exactly the stored membership number.
- Consumed by `MemberCard` only; no NFC assignment required.

- [ ] **Step 1: Install barcode renderer**

```bash
npm install jsbarcode
npm install --save-dev @types/jsbarcode
```

If `jsbarcode` ships compatible types in the installed version, omit the separate `@types` package rather than keeping duplicate declarations.

- [ ] **Step 2: Write failing barcode-contract test**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../components/member/MemberBarcode.tsx", import.meta.url), "utf8");

test("member barcode uses Code 128 and exact member number", () => {
  assert.match(source, /CODE128/);
  assert.match(source, /memberNumber/);
  assert.doesNotMatch(source, /pkCustomer|cardUid/);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
node --experimental-strip-types --test tests/member-barcode-contract.test.mjs
```

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement `MemberBarcode.tsx`**

Use a white scan area, black bars, adequate quiet zone, and no transformed/blurred SVG:

```tsx
"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

export default function MemberBarcode({ memberNumber }: { memberNumber: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !memberNumber) return;
    JsBarcode(ref.current, memberNumber, {
      format: "CODE128",
      displayValue: false,
      background: "#ffffff",
      lineColor: "#000000",
      height: 54,
      margin: 8,
      width: 1.7,
    });
  }, [memberNumber]);

  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <svg ref={ref} className="h-auto w-full" aria-label={`Member barcode ${memberNumber}`} />
      <p className="mt-1 text-center font-mono text-xs font-bold tracking-[0.16em] text-black">{memberNumber}</p>
    </div>
  );
}
```

- [ ] **Step 5: Replace launch-time NFC mark on `MemberCard`**

Remove the visible `NfcMark` and place `<MemberBarcode memberNumber={member.memberNumber} />` in a scan-friendly section of the card. Keep member name, status and expiry. Adjust minimum card height only as needed; do not redesign unrelated member pages.

- [ ] **Step 6: Run test/typecheck/build**

```bash
node --experimental-strip-types --test tests/member-barcode-contract.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/member/MemberBarcode.tsx components/member/MemberCard.tsx tests/member-barcode-contract.test.mjs
git commit -m "feat: show permanent member barcode"
```

---

### Task 11: Extract canonical check-in service and add barcode access decisions

**Files:**
- Create: `lib/barcodeAccessCore.ts`
- Create: `lib/checkinService.ts`
- Modify: `app/api/checkins/route.ts`
- Modify: `app/api/system/nfc/scan/route.ts`
- Test: `tests/barcode-access-core.test.mjs`
- Test: `tests/checkin-service-contract.test.mjs`

**Interfaces:**
- `evaluateBarcodeAccess({ member, today }) -> { result, granted }`.
- `recordCanonicalCheckin({ memberId, gymId, source }) -> { duplicate, checkinId, stats }`.
- Existing QR route calls `recordCanonicalCheckin(... source:'qr')`.
- Existing NFC route calls `recordCanonicalCheckin(... source:'nfc')`.
- Barcode route in Task 12 calls `source:'barcode'`.

- [ ] **Step 1: Write failing access-decision tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBarcodeAccess } from "../lib/barcodeAccessCore.ts";

test("active current member is granted", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({ member: { status: "active", membershipExpiry: "2027-09-09" }, today: "2026-09-09" }),
    { result: "granted", granted: true }
  );
});

test("expired member is denied", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({ member: { status: "active", membershipExpiry: "2026-09-08" }, today: "2026-09-09" }),
    { result: "expired", granted: false }
  );
});

test("unknown member is denied", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({ member: null, today: "2026-09-09" }),
    { result: "unknown_member", granted: false }
  );
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/barcode-access-core.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement `barcodeAccessCore.ts`**

Keep it pure; no database calls.

- [ ] **Step 4: Extract the duplicated check-in insert/stats logic**

Move the two-hour duplicate check and stats refresh into `lib/checkinService.ts`. The service must accept only server-supplied member/gym IDs and a source union:

```ts
export type CheckinSource = "qr" | "nfc" | "barcode";

export async function recordCanonicalCheckin(input: {
  memberId: string;
  gymId: string;
  source: CheckinSource;
}) { /* existing duplicate + insert + stats behavior */ }
```

- [ ] **Step 5: Update existing QR and NFC routes to use the service**

Preserve current behavior. The NFC route should also write `credential_type='nfc'` and `credential_value=cardUid` to `bgm_access_scans` after Task 1 schema exists.

- [ ] **Step 6: Add a static contract test ensuring all three sources are accepted**

Verify `lib/checkinService.ts` contains `"qr" | "nfc" | "barcode"` and the QR/NFC routes import it rather than carrying their own direct check-in insert logic.

- [ ] **Step 7: Run tests/typecheck**

```bash
node --experimental-strip-types --test tests/barcode-access-core.test.mjs tests/checkin-service-contract.test.mjs tests/nfc-access-core.test.mjs
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/barcodeAccessCore.ts lib/checkinService.ts app/api/checkins/route.ts app/api/system/nfc/scan/route.ts tests/barcode-access-core.test.mjs tests/checkin-service-contract.test.mjs
git commit -m "refactor: share canonical checkin pipeline"
```

---

### Task 12: Add barcode reception API and replace launch NFC reception UI

**Files:**
- Create: `app/api/system/barcode/scan/route.ts`
- Create: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `app/staff/reception/page.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `components/admin/SystemUsersAdmin.tsx`
- Test: `tests/barcode-reception-contract.test.mjs`

**Interfaces:**
- `POST /api/system/barcode/scan` body `{ membershipNumber, gymId?, deviceId? }`.
- Requires `barcode.scan`.
- Returns active/expired/inactive/unknown result, member display data, duplicate flag, scan timestamp and gym.
- Staff page remains `/staff/reception`; launch UI says Barcode, not NFC.

- [ ] **Step 1: Write failing reception contract test**

Require direct member-number lookup and canonical `barcode` check-in:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/system/barcode/scan/route.ts", import.meta.url), "utf8");

test("barcode scan resolves member number directly", () => {
  assert.match(route, /barcode\.scan/);
  assert.match(route, /member_number/);
  assert.match(route, /source:\s*["']barcode["']/);
  assert.doesNotMatch(route, /bgm_nfc_cards/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/barcode-reception-contract.test.mjs
```

Expected: FAIL because the barcode route does not exist.

- [ ] **Step 3: Implement barcode scan route**

Flow:

1. `requireSystemPermission(request, "barcode.scan")`.
2. Normalize/validate exact `BGM[0-9]{7}` membership number.
3. Resolve gym from authenticated gym account or Super Admin selected gym.
4. Validate active gym.
5. Query `bgm_members` by `member_number` only.
6. Evaluate with `evaluateBarcodeAccess`.
7. On grant, call `recordCanonicalCheckin({ memberId, gymId, source: "barcode" })`.
8. Always log the attempt to `bgm_access_scans` with `credential_type='barcode'`, `credential_value=membershipNumber`, and no NFC card.
9. Return member name/number/status/expiry/enrollment context and official photo path when identified.

- [ ] **Step 4: Implement `BarcodeReceptionPage` from the proven NFC reception UX**

Keep the proven fast-scanning behavior: autofocus, Enter submit, success/warning sound, full-screen green/red result, auto-reset, Super Admin gym selector. Change copy/input to:

- `Reception / Barcode`
- `READY TO SCAN`
- `Scan the member barcode from their BGM app.`
- input placeholder `Barcode scanner input`
- unknown: `MEMBER NOT FOUND`

Do not include NFC assignment/replacement controls.

- [ ] **Step 5: Switch `/staff/reception` to barcode component**

```tsx
import BarcodeReceptionPage from "@/components/staff/BarcodeReceptionPage";

export const dynamic = "force-dynamic";

export default function StaffReceptionPage() {
  return <BarcodeReceptionPage />;
}
```

Keep `NfcReceptionPage.tsx` in the repository but unreferenced by launch navigation.

- [ ] **Step 6: Update staff home and permission labels**

Change `Reception / NFC` -> `Reception / Barcode`, check `barcode.scan`, and make the enabled reception tile navigate to `/staff/reception`. If the shared `FeatureCard` is currently display-only, add an optional `href` prop and render an `<a>` only when `enabled && href`; do not make disabled features clickable.

- [ ] **Step 7: Run tests/typecheck/build**

```bash
node --experimental-strip-types --test tests/barcode-reception-contract.test.mjs tests/barcode-access-core.test.mjs tests/system-permissions.test.mjs tests/nfc-*.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS; NFC tests continue passing even though launch UI no longer exposes NFC.

- [ ] **Step 8: Commit**

```bash
git add app/api/system/barcode/scan/route.ts components/staff/BarcodeReceptionPage.tsx app/staff/reception/page.tsx components/staff/StaffLoginPage.tsx components/admin/SystemUsersAdmin.tsx tests/barcode-reception-contract.test.mjs
git commit -m "feat: use member barcodes at reception"
```

---

### Task 13: Add explicit New Membership / Renewal enrollment identity flow

**Files:**
- Create: `lib/membershipEnrollmentCore.ts`
- Create: `app/api/system/members/search/route.ts`
- Create: `app/api/system/members/enroll/route.ts`
- Create: `components/staff/MembershipEnrollmentPage.tsx`
- Create: `app/staff/members/enroll/page.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `supabase/migrations/20260909_140000_membership_identity_exchange.sql` only if not yet applied; otherwise create a follow-up migration for application-kind/existing-member linkage.
- Test: `tests/membership-enrollment-core.test.mjs`
- Test: `tests/membership-enrollment-contract.test.mjs`

**Interfaces:**
- Enrollment starts with `new` or `renewal`.
- New member insert omits `member_number` so DB assigns it at committed creation/activation.
- Renewal requires an existing member ID and never inserts a replacement person row.
- Search supports membership number first, then name/mobile/email/legacy PK as fallback.

- [ ] **Step 1: Write failing identity-flow tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildEnrollmentIdentityAction } from "../lib/membershipEnrollmentCore.ts";

test("new enrollment creates person without client-generated number", () => {
  assert.deepEqual(
    buildEnrollmentIdentityAction({ kind: "new", existingMemberId: "" }),
    { kind: "create_person" }
  );
});

test("renewal requires and reuses existing member identity", () => {
  assert.deepEqual(
    buildEnrollmentIdentityAction({ kind: "renewal", existingMemberId: "m1" }),
    { kind: "reuse_person", memberId: "m1" }
  );
  assert.throws(() => buildEnrollmentIdentityAction({ kind: "renewal", existingMemberId: "" }));
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/membership-enrollment-core.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement pure enrollment identity helper**

Keep the new-vs-renewal decision independent from UI and database details.

- [ ] **Step 4: Add application linkage schema**

Add:

```sql
alter table public.bgm_membership_applications
  add column if not exists application_kind text not null default 'new';

alter table public.bgm_membership_applications
  drop constraint if exists bgm_membership_applications_application_kind_check;

alter table public.bgm_membership_applications
  add constraint bgm_membership_applications_application_kind_check
  check (application_kind in ('new', 'renewal'));

alter table public.bgm_membership_application_members
  add column if not exists existing_member_id uuid references public.bgm_members(id) on delete restrict;
```

Use a follow-up migration if Task 1 migration has already been applied.

- [ ] **Step 5: Implement member search API**

Require `members.view`. Support query types:

- exact membership number/barcode;
- name substring;
- mobile/contact email;
- legacy PK, returning all candidates when duplicates exist.

Return enough data to let staff confirm identity, including member number, full name, status, expiry and official photo reference where permission allows. Never auto-select when multiple legacy matches exist.

- [ ] **Step 6: Implement enrollment API identity rules**

Require appropriate permissions (`members.create` for new, `members.renew` for renewal, `membership.activate` at payment activation). New person creation must omit member number. Renewal must reference the existing member and create a new `bgm_memberships` period linked through `bgm_membership_members`; it must update compatibility expiry/status on that same `bgm_members` row.

Do not add NFC assignment.

- [ ] **Step 7: Implement first-choice UI**

At `/staff/members/enroll`, first screen contains two large choices:

- `NEW MEMBERSHIP`
- `RENEWAL`

For renewal, search/confirm the existing member before showing duration/details. Show the permanent member number prominently and copy `This number and barcode stay with this member.`

Continue to use the already-approved membership types/durations and `PAYMENT RECEIVED — ACTIVATE` rule. Printing never activates.

- [ ] **Step 8: Add staff navigation**

Make the Members feature route to enrollment/member tools according to permission, without breaking the existing admin member list.

- [ ] **Step 9: Run focused tests/typecheck/build**

```bash
node --experimental-strip-types --test tests/membership-enrollment-core.test.mjs tests/membership-enrollment-contract.test.mjs tests/member-number-core.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/membershipEnrollmentCore.ts app/api/system/members components/staff/MembershipEnrollmentPage.tsx app/staff/members/enroll components/staff/StaffLoginPage.tsx supabase/migrations tests/membership-enrollment-core.test.mjs tests/membership-enrollment-contract.test.mjs
git commit -m "feat: separate new membership from renewal"
```

---

### Task 14: Controlled real-workbook Preview verification and regression gate

**Files:**
- Modify: `QA_CHECKLIST.md`
- Do not commit: `/mnt/data/AllCustomers 2026-09-03.xlsx`

**Interfaces:**
- Uses the actual supplied workbook only as a manual/private Preview input.
- Produces evidence for user acceptance; does not merge to `main`.

- [ ] **Step 1: Run the complete automated suite locally/CI**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Expected: all tests pass, typecheck passes, build passes.

- [ ] **Step 2: Verify development database schema**

Confirm:

- `bgm_members.member_number` remains unique and now has allocator default;
- email accepts blanks/duplicates;
- staging tables have RLS enabled;
- access scans support barcode credentials;
- NFC tables remain present.

- [ ] **Step 3: Upload the real 25,418-row workbook in Preview mode only**

Expected preview characteristics based on the supplied file shape:

- 15 legacy headers recognized;
- 25,418 data rows read;
- formula cells are reported for review rather than executed;
- no members are deleted;
- no permanent numbers are consumed during preview.

Do not commit the file or any exported copy containing real member data.

- [ ] **Step 4: Fix only source-data issues explicitly surfaced by preview**

For example, formula cells in telephone fields must be converted to literal intended values by an authorized human before apply. Do not infer their intended phone number from the formula text/result inside code.

- [ ] **Step 5: Run a small synthetic apply before any full real-data apply**

Use a separate test batch containing:

- one new blank-number member;
- one existing-number update;
- one expired renewal candidate.

Verify number permanence, no deletion, barcode rendering, active/expired scan behavior, and check-in source `barcode`.

- [ ] **Step 6: Update QA checklist**

Add explicit checks for:

- XLSX/CSV 16-column export;
- legacy 15-column preview;
- zero-deletion import;
- permanent number allocation;
- renewal number reuse;
- barcode display and scanner;
- duplicate-email activation/reset behavior;
- NFC still dormant/intact.

- [ ] **Step 7: Commit QA update**

```bash
git add QA_CHECKLIST.md
git commit -m "test: add membership migration barcode QA"
```

- [ ] **Step 8: Push branch and verify GitHub Actions + Vercel Preview**

Verify the latest branch SHA passes:

- tests;
- TypeScript;
- Next.js build;
- Vercel Preview deployment.

- [ ] **Step 9: User acceptance checkpoint**

Do not merge to `main`. Ask the user to test:

1. Download XLSX and open it in Excel.
2. Download CSV and verify same 16 headers/order.
3. Preview-upload XLSX and confirm summary/conflicts.
4. Open a member virtual card and scan the barcode with reception.
5. Verify active scan green + sound + check-in.
6. Verify expired scan red + warning + no check-in.
7. Verify Renewal reuses the existing membership number.

Only after explicit acceptance should a separate merge/release decision be made.

---

## Plan Self-Review Result

- **Spec coverage:** permanent number, lifetime reuse rule, 15/16-column import, XLSX/CSV export, staged/non-destructive import, pilot-safe number allocation, barcode member card, barcode reception, canonical check-ins, dormant NFC, New/Renewal enrollment and QA are all mapped to tasks.
- **Known data constraint addressed:** the supplied workbook contains blank/duplicate email values, so the current `email NOT NULL UNIQUE` schema and email-only password reset cannot survive migration unchanged; Task 1 and Task 9 resolve this without inventing data.
- **Known source anomaly addressed:** formula cells are explicitly review-blocking input issues rather than executed or silently converted.
- **Type/interface consistency:** `MembershipNumber` is always text; barcode payload is the same exact string; imports never use `pkCustomer` as the permanent identity.
- **Destructive-sync removal:** both API and UI delete language/logic are explicitly removed, and tests guard against reintroduction.
