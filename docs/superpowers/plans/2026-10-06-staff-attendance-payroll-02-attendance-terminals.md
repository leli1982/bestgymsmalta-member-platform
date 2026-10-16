# Staff Attendance & Payroll Plan 02 — Terminals, Punch State & Corrections

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Execute task-by-task with TDD and verification before every completion claim.

**Goal:** Implement secure registered punch-clock terminals, the server-authoritative IN/OUT state machine, immutable punch evidence, cross-gym sessions, manual Super Admin fallback, correction audit and persisted daily payroll segments.

**Architecture:** All punch transitions execute atomically on the server/database. Terminal credential determines gym. The next valid punch toggles global employee state: no open session -> IN, open session -> OUT. Raw punch events are immutable; work sessions are effective records; closed sessions generate immutable Malta-calendar payroll segments using the effective wage/employment/holiday configuration.

**Tech Stack:** Next.js 16, TypeScript, Supabase/PostgreSQL RPC/transactions, Node tests, crypto SHA-256/random tokens, existing Super Admin auth/audit.

**Spec:** `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`

## Global Constraints

- One open session max per employee across all gyms.
- Terminal gym comes from active terminal credential only; never trust request-body gym.
- Inactive employees cannot punch.
- Disabled terminals cannot punch.
- Duplicate/rapid scan must be idempotent and must not reverse the first action.
- Manual Super Admin punches are permitted and require a reason.
- Open/missing sessions remain Needs Attention; never auto-clock-out.
- Cross-gym clock-out is valid.
- Raw punch events cannot be edited/deleted.
- Corrections preserve before/after and actor/reason.
- All payroll allocation is per Malta calendar day and exact minute.
- No overtime premium.

## Task 1: Add terminal credential primitives

**Files:**
- Create: `lib/staffTerminalAuth.ts`
- Create: `tests/staff-terminal-auth.test.mjs`

**Interfaces:**

```ts
export function createTerminalSecret(): string;
export function hashTerminalSecret(secret: string): string;
export function terminalCookieName(): string;
export function constantTimeSecretHashEquals(a: string, b: string): boolean;
```

- [ ] **Step 1: Write RED tests**

Cover cryptographically random secret length, stable SHA-256 hash, different secrets -> different hashes, cookie name stability and constant-time comparison behavior.

- [ ] **Step 2: Prove RED**

```bash
node --experimental-strip-types --test tests/staff-terminal-auth.test.mjs
```

- [ ] **Step 3: Implement minimal primitives**

Use Node `crypto.randomBytes(32).toString("base64url")` and SHA-256. Never store plaintext terminal secrets in the database.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-terminal-auth.test.mjs
git add lib/staffTerminalAuth.ts tests/staff-terminal-auth.test.mjs
git commit -m "feat: add punch clock terminal credentials"
```

---

## Task 2: Add Super Admin terminal management and provisioning

**Files:**
- Create: `app/api/system/staff-terminals/route.ts`
- Create: `app/api/system/staff-terminals/[terminalId]/route.ts`
- Create: `app/api/system/staff-terminals/[terminalId]/provision/route.ts`
- Create: `app/api/staff-punch-clock/session/route.ts`
- Create: `tests/staff-terminal-api-contract.test.mjs`

**Interfaces:**
- `GET/POST /api/system/staff-terminals`
- `PATCH /api/system/staff-terminals/:id`
- `POST /api/system/staff-terminals/:id/provision` rotates/creates credential and returns a one-time setup token or sets the terminal cookie in a controlled setup flow.
- `GET /api/staff-punch-clock/session` resolves active terminal identity/gym from the HttpOnly credential cookie.

- [ ] **Step 1: Write RED contracts**

Require `requireSuperAdmin` on management/provisioning. Assert kiosk session route does not use client `gymId`. Assert only credential hash is stored. Assert cookie flags include `HttpOnly`, `Secure` in production and `SameSite=Lax`/appropriate strictness.

- [ ] **Step 2: Implement terminal CRUD**

Fields: name, gym ID, active, vendor/model optional, last seen. Create does not silently expose permanent secret in normal list responses.

Audit:
- `staff.terminal.created`
- `staff.terminal.updated`
- `staff.terminal.credential_rotated`
- `staff.terminal.status_changed`

- [ ] **Step 3: Implement provisioning/session resolution**

Provisioning generates a new secret, stores only its hash, and returns/sets it once. Rotating invalidates the old credential immediately.

Kiosk session route hashes cookie secret, resolves exactly one active terminal, updates `last_seen_at` at a throttled cadence, and returns only safe terminal metadata: terminal ID, name, gym ID/name, hardware integration state.

- [ ] **Step 4: Run contracts and commit**

```bash
node --experimental-strip-types --test tests/staff-terminal-auth.test.mjs tests/staff-terminal-api-contract.test.mjs
git add app/api/system/staff-terminals app/api/staff-punch-clock/session lib/staffTerminalAuth.ts tests/staff-terminal-api-contract.test.mjs
git commit -m "feat: add registered punch clock terminals"
```

---

## Task 3: Add Malta session splitting and payroll-segment calculation

**Files:**
- Modify: `lib/staffAttendanceCore.ts`
- Modify: `tests/staff-attendance-core.test.mjs`

**Interfaces:**

```ts
export type SessionSlice = { calendarDate: string; start: Date; end: Date; workedMinutes: number };
export function splitSessionByMaltaDate(clockIn: Date, clockOut: Date): SessionSlice[];
export function workedMinutes(start: Date, end: Date): number;
```

- [ ] **Step 1: Add RED tests**

Cover:
- same-day 08:00 -> 12:00 = 240 minutes;
- multiple sessions are independently calculable;
- 22:00 -> 06:00 splits into 120 and 360 minutes;
- public holiday begins at midnight and only that date's slice gets holiday multiplier;
- DST spring/fall Malta dates use actual elapsed minutes, not assumed 24-hour UTC days;
- invalid end before start rejected.

Use explicit ISO timestamps with Malta offset around DST tests and/or `maltaDayUtcRange()` to derive boundaries.

- [ ] **Step 2: Implement with Malta calendar boundaries**

Reuse `lib/maltaDate.ts`; do not hard-code `+02:00` because Malta changes DST.

- [ ] **Step 3: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-attendance-core.test.mjs
git add lib/staffAttendanceCore.ts tests/staff-attendance-core.test.mjs
git commit -m "feat: add Malta attendance day splitting"
```

---

## Task 4: Add atomic punch transition service/RPC

**Files:**
- Add migration: `supabase/migrations/20261006_121000_staff_punch_state.sql`
- Create: `lib/staffAttendanceServer.ts`
- Create: `tests/staff-punch-state-contract.test.mjs`

**Interfaces:**
- Database RPC/service: `bgm_staff_record_punch(...)` or equivalent transactional function.
- Produces one of:
  - `clocked_in`
  - `clocked_out`
  - `duplicate_ignored`
  - `inactive_employee`
  - `inactive_terminal`
  - validation error.

- [ ] **Step 1: Write RED schema/service contract tests**

Assert transaction locks the employee/open session state (`FOR UPDATE` or equivalent advisory/row lock), enforces unique event idempotency and never takes authoritative gym from caller when source is terminal.

- [ ] **Step 2: Implement atomic state transition**

For a terminal punch:

1. authenticate/resolve active terminal;
2. resolve active employee identity from trusted adapter result;
3. normalize event timestamp to effective minute but preserve raw timestamp;
4. reject same idempotency key;
5. apply a short server cooldown for same employee/terminal to prevent accidental immediate reversal;
6. lock employee/open-session state;
7. if no open session, append IN event + create open session;
8. if open session, append OUT event + close session using this terminal's gym as `clock_out_gym_id`;
9. generate daily payroll segments before commit;
10. return safe confirmation payload.

Do not auto-close stale sessions.

- [ ] **Step 3: Payroll segment generation on OUT**

For each Malta-date slice, resolve:
- rate record effective on segment date;
- employment type effective on segment date;
- current holiday version for that calendar date as it existed at calculation time;
- selected multiplier.

Persist all IDs/snapshot values + minutes + `pay_cents` in `bgm_staff_session_payroll_segments`.

If required rate or employment history is missing for a slice, do not silently calculate zero. Mark session `needs_attention`/calculation failure and surface to Super Admin.

- [ ] **Step 4: Add concurrency/idempotency TEST-database verification**

Against TEST Supabase, create a temporary employee/terminal fixture and issue two concurrent identical punch requests. Verify exactly one event transition/open session is created. Clean the fixture after verification.

- [ ] **Step 5: Run tests and commit**

```bash
node --experimental-strip-types --test tests/staff-punch-state-contract.test.mjs tests/staff-attendance-core.test.mjs
git add supabase/migrations/20261006_121000_staff_punch_state.sql lib/staffAttendanceServer.ts tests/staff-punch-state-contract.test.mjs
git commit -m "feat: add atomic staff punch state engine"
```

---

## Task 5: Add terminal punch endpoint and biometric adapter boundary

**Files:**
- Create: `lib/staffBiometricAdapter.ts`
- Create: `app/api/staff-punch-clock/punch/route.ts`
- Create: `tests/staff-punch-endpoint-contract.test.mjs`

**Interfaces:**

```ts
export type BiometricMatch = { employeeId: string; adapterEventId: string; matchedAt: string };
export interface StaffBiometricAdapter {
  resolveMatch(input: unknown): Promise<BiometricMatch>;
}
```

- [ ] **Step 1: Write RED endpoint contracts**

Assert:
- no employee selector/query param is accepted as trusted production identity;
- terminal cookie auth is required;
- terminal gym is server-resolved;
- route calls adapter then `recordStaffPunch`;
- response exposes only employee name/photo URL, IN/OUT result, gym, time, daily minutes; no pay/rate/history.

- [ ] **Step 2: Implement adapter interface and disabled placeholder**

Until hardware arrives, production adapter returns a clear `hardware_not_configured` result. Tests inject/mock an adapter implementation. Do not ship a hidden employee dropdown as a fake fingerprint reader.

- [ ] **Step 3: Implement punch route around adapter/service**

Map safe errors to user-facing kiosk copy without revealing database or credential details.

- [ ] **Step 4: Run and commit**

```bash
node --experimental-strip-types --test tests/staff-punch-endpoint-contract.test.mjs tests/staff-punch-state-contract.test.mjs
git add lib/staffBiometricAdapter.ts app/api/staff-punch-clock/punch/route.ts tests/staff-punch-endpoint-contract.test.mjs
git commit -m "feat: add punch clock biometric boundary"
```

---

## Task 6: Add Super Admin manual punch and correction APIs

**Files:**
- Create: `app/api/system/staff-attendance/manual-punch/route.ts`
- Create: `app/api/system/staff-attendance/sessions/[sessionId]/route.ts`
- Create: `tests/staff-attendance-correction-contract.test.mjs`

**Interfaces:**
- `POST /manual-punch`: employee, action, gym, local date/time/ISO instant, mandatory reason.
- `PATCH /sessions/:id`: corrected clock-in/out timestamp and/or gym, mandatory reason.

- [ ] **Step 1: Write RED contracts**

Require Super Admin. Require non-empty reason. Assert manual punch creates immutable punch event with `source=super_admin`. Assert correction inserts adjustment and central audit; does not update/delete punch event. Assert corrected closed session regenerates payroll segments from current effective-date history while retaining old adjustment evidence.

- [ ] **Step 2: Implement manual IN/OUT through the same state engine**

Manual punches obey one-open-session rule but do not require a terminal credential. Gym is explicitly selected by Super Admin and validated against active/known gym records.

- [ ] **Step 3: Implement correction transaction**

Validate:
- corrected out > corrected in;
- referenced gyms exist;
- no overlap/contradiction with another session for same employee unless explicitly supported later;
- reason mandatory.

Within one transaction:
1. capture before snapshot;
2. update effective session fields;
3. delete/rebuild only derived payroll segments for that session;
4. insert immutable adjustment row;
5. insert central audit entry.

Original punch events stay untouched.

- [ ] **Step 4: Run and commit**

```bash
node --experimental-strip-types --test tests/staff-attendance-correction-contract.test.mjs tests/staff-punch-state-contract.test.mjs
git add app/api/system/staff-attendance lib/staffAttendanceServer.ts tests/staff-attendance-correction-contract.test.mjs
git commit -m "feat: add manual staff punches and corrections"
```

---

## Task 7: Build terminal management UI and kiosk shell

**Files:**
- Create: `components/staff/StaffTerminalsAdmin.tsx`
- Create: `app/staff/punch-clock/page.tsx`
- Create: `components/staff/StaffPunchClockKiosk.tsx`
- Create: `tests/staff-punch-kiosk-ui-contract.test.mjs`

**Interfaces:**
- Staff management `Punch Clock Terminals` view.
- Kiosk `/staff/punch-clock` uses registered terminal cookie/session.

- [ ] **Step 1: Write RED UI contracts**

Terminal admin must expose name, gym, active status, last seen, hardware state and credential rotate/provision action.

Kiosk must show gym identity/current clock/waiting state and must not show payroll, directory or manual employee selector.

- [ ] **Step 2: Implement terminal admin UI**

Provision/rotate uses a deliberate confirmation. If the one-time credential must be copied/setup, make that one-time nature explicit.

- [ ] **Step 3: Implement kiosk states**

States:
- terminal not registered;
- hardware not connected/configured;
- waiting for fingerprint;
- processing;
- CLOCKED IN;
- CLOCKED OUT;
- duplicate ignored;
- employee inactive;
- needs attention/error.

Success resets automatically after a short display period. Error/attention states remain long enough for staff to read and allow retry.

- [ ] **Step 4: Run UI tests/type/build and commit**

```bash
node --experimental-strip-types --test tests/staff-punch-kiosk-ui-contract.test.mjs tests/staff-terminal-api-contract.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build

git add components/staff/StaffTerminalsAdmin.tsx app/staff/punch-clock/page.tsx components/staff/StaffPunchClockKiosk.tsx tests/staff-punch-kiosk-ui-contract.test.mjs
git commit -m "feat: add punch clock terminal ui"
```

## Plan 02 completion checkpoint

Before Plan 03, verify in TEST:

- employee can be manually punched IN at Gym A and OUT at Gym B;
- same-day multiple sessions remain separate;
- daily segments/totals are correct;
- public-holiday Full Time/Part Time multiplier snapshot is correct;
- concurrent duplicate scan simulation is idempotent;
- forgotten OUT leaves an open Needs Attention session;
- correction preserves original punch event and produces adjustment audit;
- kiosk cannot spoof gym or access payroll;
- actual hardware remains intentionally unconnected until Plan 04.