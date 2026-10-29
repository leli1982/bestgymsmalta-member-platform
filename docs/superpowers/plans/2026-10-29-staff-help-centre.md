# Staff Help Centre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a searchable, context-aware Help Centre available from every Staff Portal page, backed by the approved Staff Manual procedures.

**Architecture:** Add static typed help content and pure search/context helpers, then a global modal client component mounted in the shared Staff layout. A full `/staff/help` page renders the same source content so popup and full manual cannot drift.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, lucide-react, Node test suite.

**Spec:** `docs/superpowers/plans/2026-10-29-staff-help-centre-design.md`

## Global Constraints
- TEST/feature branch only; do not touch Production.
- No database migration or external API.
- Search is local, case-insensitive and instant.
- Bar copy must describe auto-save and no Send Bar List button.
- End of Day copy must state submission locks that day's Bar sheet.
- Punch Clock remains excluded until the HU20 integration is released.

## Review Focus
- Route matching should not promote the wrong topic for nested staff paths.
- Search should match synonyms such as `lost card`, `expired`, `cash`, `voucher`, and `photo`.
- Modal must not block global scanner behaviour when closed.
- Escape/close and mobile layout must remain usable.
- Staff help must not expose Super Admin-only procedures.

---

### Task 1: Help content and search helpers

**Files:**
- Create: `lib/staffHelpContent.ts`
- Test: `tests/staff-help-content.test.mjs`

**Interfaces:**
- Produces: `STAFF_HELP_TOPICS`, `searchStaffHelpTopics(query)`, `getContextStaffHelpTopic(pathname)`.

- [ ] Write failing contract/unit tests for topic coverage, synonyms, Bar/End-of-Day safety copy and route context.
- [ ] Run test and confirm RED.
- [ ] Implement typed topic data and pure search/context helpers.
- [ ] Run focused test and confirm GREEN.

### Task 2: Global Help modal

**Files:**
- Create: `components/staff/StaffHelpCentre.tsx`
- Modify: `app/staff/layout.tsx`
- Test: `tests/staff-help-centre-contract.test.mjs`

**Interfaces:**
- Consumes: helpers from Task 1.
- Produces: floating `? Help` button and searchable modal on every Staff route.

- [ ] Write failing contract test for global layout mount, search field, contextual recommendation and full-manual action.
- [ ] Run test and confirm RED.
- [ ] Implement accessible modal with mobile/desktop layout and route-aware suggestion.
- [ ] Run focused test and confirm GREEN.

### Task 3: Full in-app Staff Manual

**Files:**
- Create: `app/staff/help/page.tsx`
- Create: `components/staff/StaffHelpManualPage.tsx`
- Test: extend `tests/staff-help-centre-contract.test.mjs`

**Interfaces:**
- Consumes: the same `STAFF_HELP_TOPICS` source.
- Produces: `/staff/help` searchable full manual view.

- [ ] Add failing assertions for shared-content full-manual page.
- [ ] Run test and confirm RED.
- [ ] Implement full manual page using the same topic source.
- [ ] Run focused tests and confirm GREEN.

### Task 4: Verification and TEST preview

**Files:**
- No production files beyond Tasks 1-3.

- [ ] Run focused Help tests.
- [ ] Run TypeScript and build.
- [ ] Run the repository test/CI suite required for Staff Portal regressions.
- [ ] Create one TEST preview only after checks are green.
