# Versioned Enrollment and Renewal Welcome Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every newly activated enrollment and renewal a versioned welcome pack containing the declarations actually accepted plus a completed membership-form PDF, without allowing delivery failure to affect activation.

**Architecture:** Extend the existing `welcomePackage` pipeline rather than adding a second delivery path. Resolve declaration content snapshot-first with published fallback, generate all PDF attachments server-side from shared printable application data, and enrich the existing audit entry with declaration versions and application kind.

**Tech Stack:** Next.js route handlers, TypeScript, Supabase, Nodemailer/Gmail, existing custom PDF generation, Node contract tests, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-11-03-versioned-welcome-pack.md`

## Global Constraints

- Production `main` remains untouched until explicit merge approval.
- Existing membership activation semantics must not change.
- Email/PDF failures are best-effort and must never roll back or fail activation.
- Use `declaration_snapshot` as primary source; published declarations are fallback only for missing snapshot content.
- Keep the recent-activation guard and per-recipient audit deduplication.
- Support both `new` and `renewal` applications.
- No new database table unless an existing structure proves insufficient.

## Review Focus

- Renewal activation must qualify for the same welcome pipeline without changing member reuse semantics.
- A declaration published after submission must not replace the version already stored in the application snapshot.
- Missing historical snapshot content must fall back only for the missing declaration, not replace intact snapshot entries.
- Guardian attachment must be omitted for participants to whom guardian consent does not apply.
- PDF/mail generation failure must leave activation and wallet/card sync successful.

---

### Task 1: Expand welcome-package contract to renewals and version auditing

**Files:**
- Modify: `tests/welcome-package.test.mjs`
- Modify: `lib/welcomePackage.ts`
- Modify: `lib/welcomeEmailCore.ts`

**Interfaces:**
- Consumes: `bgm_membership_applications.application_kind`, `declaration_snapshot`, existing audit log.
- Produces: welcome delivery for `new | renewal`, `applicationKind` email input, `declarationVersions` in audit `after_data`.

- [ ] **Step 1: Write failing tests**

Add assertions that the package accepts both new and renewal applications, prefers snapshot versions, records versions in the audit payload, and renders renewal-specific copy.

- [ ] **Step 2: Run tests and verify RED**

Expected: failures proving renewal/version behaviour is absent.

- [ ] **Step 3: Implement minimal renewal/version support**

Remove the new-only early return/filter, preserve the recent activation guard, add application kind to email rendering, and record the resolved declaration versions in the existing audit row.

- [ ] **Step 4: Run focused tests and verify GREEN**

- [ ] **Step 5: Commit**

---

### Task 2: Generic declaration PDF attachments

**Files:**
- Create: `lib/declarationPdf.ts`
- Modify: `lib/gymRulesPdf.ts`
- Modify: `lib/welcomeMailer.ts`
- Modify: `tests/welcome-package.test.mjs`

**Interfaces:**
- Consumes: resolved welcome declarations.
- Produces: `buildDeclarationPdf({ title, declaration })`, stable declaration filenames, attachments for Gym Rules, Health Declaration, Privacy/GDPR, and Guardian Consent when applicable.

- [ ] **Step 1: Write failing tests**

Require all applicable declaration PDFs and verify guardian omission when not applicable.

- [ ] **Step 2: Run tests and verify RED**

- [ ] **Step 3: Implement generic declaration PDF builder and mail attachments**

Preserve the existing Gym Rules wrapper/API for compatibility while moving shared PDF mechanics into the generic builder.

- [ ] **Step 4: Run focused tests and verify GREEN**

- [ ] **Step 5: Commit**

---

### Task 3: Shared printable application loader and membership-form PDF

**Files:**
- Create: `lib/printableMembershipApplication.ts`
- Create: `lib/membershipFormPdf.ts`
- Modify: `app/api/system/members/applications/[applicationId]/print/route.ts`
- Modify: `lib/welcomePackage.ts`
- Modify: `lib/welcomeMailer.ts`
- Modify: `tests/welcome-package.test.mjs`
- Modify: relevant membership print contract/browser tests only if required by the extraction.

**Interfaces:**
- Produces: `loadPrintableMembershipApplication(applicationId)` returning the same `PrintableApplication` model used by Staff print; `buildMembershipFormPdf(application, participant)` returning a PDF buffer.
- Consumes: the loader from both the Staff print route and welcome package so data does not diverge.

- [ ] **Step 1: Write failing tests**

Require a real `%PDF-` membership-form attachment containing application reference, member number, participant identity, membership dates/type/payment data, and accepted declaration/version markers.

- [ ] **Step 2: Run tests and verify RED**

- [ ] **Step 3: Extract the existing print-data loading logic**

Move data assembly without changing the Staff route response contract.

- [ ] **Step 4: Build the server-side A4 membership form PDF**

Use the shared printable model; one participant form per recipient.

- [ ] **Step 5: Attach the membership PDF in the welcome mailer**

- [ ] **Step 6: Run focused tests and the existing membership-print browser verification**

Expected: all green and no Staff print regression.

- [ ] **Step 7: Commit**

---

### Task 4: Whole-branch verification and draft PR

**Files:**
- No production-code additions unless verification finds a defect.

- [ ] **Step 1: Run full test suite**

- [ ] **Step 2: Run type-check and Next.js build**

- [ ] **Step 3: Run full CI/browser verification through draft PR**

- [ ] **Step 4: Review branch diff for unrelated changes**

- [ ] **Step 5: Leave PR draft/unmerged pending explicit approval**
