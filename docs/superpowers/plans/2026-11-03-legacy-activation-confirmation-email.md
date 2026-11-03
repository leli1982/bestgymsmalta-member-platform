# Legacy Activation Confirmation Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a confirmation/welcome email after a legacy member successfully activates the app, without allowing mail failure to undo activation.

**Architecture:** Reuse the existing Gmail operations-mail configuration and Nodemailer transport in `lib/welcomeMailer.ts`. Add a focused legacy-activation mail helper, then call it only after the `bgm_members` update succeeds in `legacy-register/route.ts`; catch mail errors locally and return activation success with a `welcomeEmailSent` flag.

**Tech Stack:** Next.js route handlers, TypeScript, Nodemailer/Gmail, Node test contracts, GitHub Actions CI.

**Spec:** Existing approved legacy-activation flow and the regression contract in `tests/legacy-member-activation-contract.test.mjs`.

## Global Constraints

- Production `main` must remain untouched until explicit merge approval.
- No database/schema changes.
- Reuse the existing mail configuration; do not introduce a second mail system.
- Send only after the member update succeeds.
- Mail failure must never roll back or fail the activation.
- Keep this PR limited to legacy activation confirmation; enrollment/renewal welcome-pack versioning is separate follow-up work.

## Review Focus

- Missing/invalid recipient email: activation still succeeds; mail helper failure is contained.
- Mail configuration unavailable: activation still succeeds and `welcomeEmailSent` is false.
- Member update fails: no mail attempt occurs.
- Successful mail: response reports `welcomeEmailSent: true`.
- Existing session-cookie and recovered-member-number behavior remains unchanged.

---

### Task 1: Legacy activation confirmation mailer

**Files:**
- Modify: `lib/welcomeMailer.ts`
- Modify: `app/api/member/auth/legacy-register/route.ts`
- Test: `tests/legacy-member-activation-contract.test.mjs`

**Interfaces:**
- Consumes: existing `resolveOperationsMailConfig(...)` and cached Nodemailer transport pattern.
- Produces: `sendLegacyActivationConfirmationEmail({ recipient, memberName, memberNumber, appUrl })` and API response boolean `welcomeEmailSent`.

- [x] **Step 1: Write the failing test**

The contract test requires `sendLegacyActivationConfirmationEmail`, requires the send to appear after `const updateResult`, requires `welcomeEmailSent`, and requires a local `catch` that preserves activation success.

- [x] **Step 2: Run test to verify it fails**

GitHub Actions run 1986 failed on branch head `83248a335f2f3cb6e9ee246e68be78f6304d8bb1`, confirming RED.

- [ ] **Step 3: Implement the minimal mail helper and post-update call**

Add the helper in `lib/welcomeMailer.ts`, import it in the legacy route, attempt the send after `updateResult.error` is cleared, catch only the mail failure, and include `welcomeEmailSent` in the successful JSON response.

- [ ] **Step 4: Verify the contract and full CI pass**

Expected: the legacy activation contract passes and the branch workflow is green.

- [ ] **Step 5: Commit and leave PR #84 unmerged**

Commit only the implementation needed for this contract. Do not merge without explicit approval.
