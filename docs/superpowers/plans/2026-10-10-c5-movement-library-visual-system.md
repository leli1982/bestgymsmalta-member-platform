# C5 Movement Library & Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Trainer and Mobility & Stretch experiences with one shared, backward-compatible movement library, reusable instructional UI, and curated BGM START → END human-figure diagrams, while preserving the current rules-based workout generator and leaving the future real-AI generator unrestricted by the visual library.

**Architecture:** Add a version-controlled movement domain (`lib/movements`) that owns canonical movement definitions, explicit aliases, mobility display groupings, and conservative name resolution. Trainer plan entries may gain an optional `movementId`; legacy plans continue to resolve by name at render time. Trainer and Mobility share presentation components in `components/movements`. Unknown exercises retain the current text fallback. C5 v1 changes application code and static assets only: no Supabase migration and no historical workout-plan rewrite.

**Tech Stack:** Next.js 16 / React / TypeScript, Tailwind CSS, Node 22 native test runner with `--experimental-strip-types`, Playwright/Chromium browser verification, static WebP assets under `public/movements`, Vercel Preview.

**Spec:** `docs/superpowers/specs/2026-10-10-c5-movement-library-visual-system-design.md`

## Global Constraints

- Work only on `feature/ai-trainer-visual-library-c5` until owner QA and explicit merge approval.
- Do not change Production Supabase schema or member/workout-plan data for C5 v1.
- Do not connect a real AI model in C5 v1.
- Do not describe the existing deterministic workout generator as real generative AI in product/grant implementation notes.
- The movement catalogue is an enrichment layer, never a whitelist for future plan generation.
- Unknown/unmatched exercises must continue to render their original name/programming/notes.
- Existing saved plan JSON must remain readable without mutation.
- Do not use fuzzy matching that can silently substitute a materially different exercise.
- Diagrams must be original BGM instructional artwork: simplified faceless/minimally featured human fitness figures, not stick figures and not traced/copied from the user reference.
- First diagram batch is exactly the 12 representative movements approved in the design; do not generate the remaining catalogue until the owner reviews that batch.
- C1 member access/grace rules, C4 Google Wallet, notifications, check-in, staff and Super Admin behaviour are out of scope and must remain unchanged.
- Follow RED → GREEN → refactor/verify for each code task and commit in reviewer-sized increments.

## Review Focus

Reviewers should concentrate on:

1. **Backward compatibility:** legacy exercise strings/objects still render and saved plans are not rewritten.
2. **Resolver correctness:** explicit ID/canonical/alias matching only; no false-positive substitutions.
3. **Future AI freedom:** unknown exercises survive end-to-end without being rejected because the library lacks a visual.
4. **Single source of instructional content:** Mobility no longer duplicates canonical movement definitions owned elsewhere.
5. **Visual safety:** diagrams accurately show start/end form, arrows and equipment at mobile-readable scale.
6. **Accessibility/mobile:** detail controls are keyboard/touch accessible and 390px viewport has no page-level horizontal overflow.
7. **Regression safety:** existing Trainer generate/save/load API and member-tool light-surface contracts still pass.

---

### Task 1: Establish the movement domain and seed the current catalogue

**Files:**
- Create: `lib/movements/types.ts`
- Create: `lib/movements/catalog.ts`
- Create: `lib/movements/mobilityGroups.ts`
- Create: `tests/movement-catalog.test.mjs`

**Interfaces:**

```ts
export type MovementType =
  | "strength"
  | "machine"
  | "dumbbell"
  | "cable"
  | "bodyweight"
  | "conditioning"
  | "mobility"
  | "stretch"
  | "warmup"
  | "cooldown";

export type MovementDefinition = {
  id: string;
  name: string;
  aliases: string[];
  type: MovementType;
  bodyRegions: string[];
  primaryMuscles: string[];
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "all";
  description: string;
  startPosition: string;
  movementInstructions: string[];
  coachingCues: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  defaultProgramming?: string;
  diagramAsset?: string;
  tags: string[];
};

export type MobilityGroup = {
  id: string;
  label: string;
  intro: string;
  entries: Array<{ movementId: string; programming?: string }>;
};
```

- [ ] **Step 1: Write the failing catalogue contract.**

Create `tests/movement-catalog.test.mjs` to import the TypeScript catalogue directly and assert:
- IDs are non-empty and unique.
- Canonical names are non-empty and unique after case/whitespace normalization.
- Every alias is non-empty and does not collide with a different canonical movement/alias.
- Every mobility-group entry references a real movement ID.
- Current Trainer exercise names from `app/api/member/workout-plan/route.ts` are represented by a canonical name or explicit alias.
- Current Mobility & Stretch movement names from `components/mobility/MobilityStretchPage.tsx` are represented.
- `Dumbbell Biceps Curl` is canonical `dumbbell-biceps-curl` and explicitly accepts `Dumbbell Curl` as an alias.
- `Triceps Rope Pushdown` is canonical `triceps-rope-pushdown`; `Cable Triceps Pushdown` remains a separate movement because the attachment/setup may differ.
- No C5 catalogue entry is required to declare `diagramAsset` yet.

- [ ] **Step 2: Run the RED test.**

```bash
node --experimental-strip-types --test tests/movement-catalog.test.mjs
```

Expected: FAIL because `lib/movements/*` does not exist.

- [ ] **Step 3: Implement the minimal shared types, catalogue and mobility grouping data.**

Seed the catalogue from the current Trainer and Mobility code only. Deduplicate genuinely identical movements; keep materially different variants (for example Romanian Deadlift vs Dumbbell Romanian Deadlift) separate. Move Mobility display grouping metadata into `mobilityGroups.ts`, but do not change the page yet.

- [ ] **Step 4: Run the GREEN test.**

```bash
node --experimental-strip-types --test tests/movement-catalog.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Type-check.**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add lib/movements tests/movement-catalog.test.mjs
git commit -m "feat: add shared movement catalogue"
```

---

### Task 2: Add conservative movement resolution for new and legacy plans

**Files:**
- Create: `lib/movements/resolveMovement.ts`
- Create: `tests/movement-resolver.test.mjs`

**Interfaces:**

```ts
export type MovementLookup = string | {
  movementId?: string | null;
  name?: string | null;
};

export function resolveMovement(input: MovementLookup): MovementDefinition | null;
export function normalizeMovementName(value: string): string;
```

Resolver precedence:
1. known explicit `movementId`;
2. exact normalized canonical name;
3. exact normalized approved alias;
4. `null`.

No token similarity, substring matching, stemming, or “closest exercise” substitution.

- [ ] **Step 1: Write failing resolver tests.**

Cover:
- canonical `Lat Pulldown` resolves to `lat-pulldown`;
- safe case/extra-space normalization resolves;
- approved alias `Dumbbell Curl` resolves to `dumbbell-biceps-curl`;
- `90/90 Hip Switch` keeps slash semantics and resolves;
- known `movementId` wins over a conflicting display name;
- unknown ID falls back to a valid name only when a valid name is supplied;
- empty/null/unknown names return `null`;
- similar-but-different names do not fuzzy-match;
- `Romanian Deadlift` does not collapse into `dumbbell-romanian-deadlift`.

- [ ] **Step 2: Run RED.**

```bash
node --experimental-strip-types --test tests/movement-resolver.test.mjs
```

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the resolver using precomputed maps from the catalogue.**

Keep normalization intentionally narrow: Unicode-safe trim, whitespace collapse and lowercase. Do not strip meaningful characters such as `/` from names like `90/90 Hip Switch`, and do not broaden matching during implementation merely to make tests pass.

- [ ] **Step 4: Run GREEN plus catalogue regression.**

```bash
node --experimental-strip-types --test tests/movement-resolver.test.mjs tests/movement-catalog.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/movements/resolveMovement.ts tests/movement-resolver.test.mjs
git commit -m "feat: resolve known movements safely"
```

---

### Task 3: Build the reusable movement card/detail UI with a safe unknown fallback

**Files:**
- Create: `components/movements/MovementCard.tsx`
- Create: `components/movements/MovementDetail.tsx`
- Create: `tests/movement-ui-contract.test.mjs`
- Modify: `tests/member-tools-light-ui-contract.test.mjs`

**Interfaces:**

```ts
export type MovementProgramming = {
  sets?: string;
  reps?: string;
  duration?: string;
  rest?: string;
  notes?: string;
};

export type MovementCardProps = {
  name: string;
  movement: MovementDefinition | null;
  programming?: MovementProgramming;
  context?: "trainer" | "mobility";
};
```

`MovementCard` owns compact presentation. `MovementDetail` owns expanded technique/cues. Prefer an accessible native disclosure pattern or an explicitly labelled button with `aria-expanded`; do not require hover.

- [ ] **Step 1: Write the failing UI contract.**

Assert the new components:
- accept a nullable movement definition;
- show plan-specific programming independently of movement defaults;
- render `diagramAsset` when present;
- preserve name/programming/notes when movement is `null`;
- expose an accessible technique/details control only when there is enriched detail;
- include start position, movement instructions, coaching cues, common mistakes and safety notes where available;
- provide image alt text derived from the movement name;
- do not include stick-figure SVG artwork or inline placeholder human drawings.

Extend `member-tools-light-ui-contract.test.mjs` only enough to preserve existing Trainer/Mobility light-shell expectations after later integration.

- [ ] **Step 2: Run RED.**

```bash
node --experimental-strip-types --test tests/movement-ui-contract.test.mjs tests/member-tools-light-ui-contract.test.mjs
```

Expected: movement UI test FAIL because components do not exist; existing light UI test remains PASS.

- [ ] **Step 3: Implement the minimal shared components.**

Use the existing light visual language (`border-zinc-200`, `bg-white`, `text-zinc-950`, BGM orange accent). Diagram area must gracefully collapse to a neutral icon/“Visual guide coming soon” treatment when no asset exists. Keep long text out of the static image.

- [ ] **Step 4: Run GREEN and type-check.**

```bash
node --experimental-strip-types --test tests/movement-ui-contract.test.mjs tests/member-tools-light-ui-contract.test.mjs
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/movements tests/movement-ui-contract.test.mjs tests/member-tools-light-ui-contract.test.mjs
git commit -m "feat: add shared movement instruction cards"
```

---

### Task 4: Produce and wire the first 12 BGM instructional diagrams

**Files:**
- Modify: `lib/movements/catalog.ts`
- Create: `tests/movement-assets.test.mjs`
- Create exactly these first-batch static assets:
  - `public/movements/chest-press-machine.webp`
  - `public/movements/lat-pulldown.webp`
  - `public/movements/leg-press.webp`
  - `public/movements/romanian-deadlift.webp`
  - `public/movements/goblet-squat.webp`
  - `public/movements/seated-cable-row.webp`
  - `public/movements/shoulder-press-machine.webp`
  - `public/movements/dumbbell-biceps-curl.webp`
  - `public/movements/triceps-rope-pushdown.webp`
  - `public/movements/90-90-hip-switch.webp`
  - `public/movements/cat-cow.webp`
  - `public/movements/half-kneeling-hip-flexor-stretch.webp`

Use WebP for the entire first batch. Generate source artwork at a consistent landscape aspect ratio (approximately 16:9) and convert/optimize to WebP without visibly degrading line detail.

- [ ] **Step 1: Write a failing asset-integrity test before adding the files.**

The test should assert that the 12 approved IDs:
- exist in the catalogue;
- each declare the exact `/movements/<id>.webp` path above;
- each referenced file exists under `public/`;
- each asset is non-empty;
- no catalogue path escapes the `/movements/` directory.

- [ ] **Step 2: Add the 12 `diagramAsset` paths but not the files, then run RED.**

```bash
node --experimental-strip-types --test tests/movement-assets.test.mjs
```

Expected: FAIL with the 12 missing asset files.

- [ ] **Step 3: Generate the original BGM diagram batch.**

Use the image-generation tool with the user-provided example only as style direction, not as content to trace. Each asset must show:
- a clean faceless/minimally featured human fitness figure with realistic simplified proportions;
- START pose and END pose in one two-panel landscape composition;
- clear movement arrow(s);
- recognizable relevant equipment;
- simple gym clothing;
- uncluttered neutral background;
- no long baked-in instructional prose;
- consistent line/illustration language across male/female figures.

Inspect every generated source image for anatomy, equipment geometry and exercise-form errors before accepting it. Reject/regenerate unsafe or ambiguous artwork rather than attempting to explain around it in UI copy.

- [ ] **Step 4: Convert/optimize accepted artwork to the exact WebP files above and run GREEN.**

```bash
node --experimental-strip-types --test tests/movement-assets.test.mjs tests/movement-catalog.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Inspect all 12 through the shared card at narrow/mobile size.**

Do not create a permanent extra member page solely for QA. Use the shared card component or a test fixture to verify readability.

- [ ] **Step 6: Commit the first visual batch.**

```bash
git add public/movements lib/movements/catalog.ts tests/movement-assets.test.mjs
git commit -m "feat: add first BGM movement diagram batch"
```

**STOP GATE:** Present the 12-diagram batch to the owner for visual approval. Do not generate the remaining catalogue artwork until approved. Product-code integration may continue with these 12 assets, but Task 9 is blocked by this gate.

---

### Task 5: Enrich Trainer plans while preserving generation/save/load compatibility

**Files:**
- Modify: `app/api/member/workout-plan/route.ts`
- Modify: `components/trainer/AiTrainer.tsx`
- Create: `tests/trainer-movement-integration.test.mjs`

**Interfaces:**

Extend plan exercise objects compatibly:

```ts
type PlanExercise =
  | string
  | {
      movementId?: string;
      name?: string;
      sets?: string;
      reps?: string;
      notes?: string;
    };
```

Do not require `movementId` when parsing saved plans.

- [ ] **Step 1: Write failing Trainer integration tests.**

Cover:
- generated known exercises include the expected movement IDs without changing their existing names/sets/reps/notes;
- API request inputs and member access checks remain unchanged;
- legacy object with no movement ID resolves by name at render time;
- legacy string exercise still renders;
- unknown exercise object still renders original content and does not disappear;
- Trainer uses `MovementCard` for structured known/unknown objects instead of duplicating rich movement UI;
- existing `/api/member/workout-plan` endpoint path remains intact.

- [ ] **Step 2: Run RED plus current member-tool contract.**

```bash
node --experimental-strip-types --test tests/trainer-movement-integration.test.mjs tests/member-tools-light-ui-contract.test.mjs
```

Expected: new integration test FAIL; current contract PASS.

- [ ] **Step 3: Add movement IDs to current deterministic generator outputs with the smallest possible diff.**

Do not rewrite the split/rep logic. Each current known exercise keeps the same programming and display name while gaining a stable ID where the catalogue has a canonical mapping.

- [ ] **Step 4: Update `AiTrainer.tsx` normalization/rendering.**

Preserve support for old string exercises, old object exercises, and new objects with `movementId`. Resolve at render time and pass plan-specific sets/reps/notes to `MovementCard`. Do not mutate or resave an old plan merely because it resolved successfully.

- [ ] **Step 5: Run GREEN, all movement tests, type-check and build.**

```bash
node --experimental-strip-types --test \
  tests/movement-catalog.test.mjs \
  tests/movement-resolver.test.mjs \
  tests/movement-ui-contract.test.mjs \
  tests/movement-assets.test.mjs \
  tests/trainer-movement-integration.test.mjs \
  tests/member-tools-light-ui-contract.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add app/api/member/workout-plan/route.ts components/trainer/AiTrainer.tsx tests/trainer-movement-integration.test.mjs
git commit -m "feat: enrich trainer plans with movement guides"
```

---

### Task 6: Convert Mobility & Stretch to the shared catalogue without changing its member intent

**Files:**
- Modify: `components/mobility/MobilityStretchPage.tsx`
- Modify if required: `lib/movements/mobilityGroups.ts`
- Create: `tests/mobility-movement-integration.test.mjs`
- Modify: `tests/member-tools-light-ui-contract.test.mjs`

- [ ] **Step 1: Write failing Mobility integration tests.**

Cover:
- the current group IDs/labels remain available (`fullBody`, chest, back, shoulders, arms, legs, hips, neck, `postWorkout`, desk);
- group entries reference the shared movement catalogue rather than duplicating instructions in the component;
- 90/90 Hip Switch, Wall Angels, Cat-Cow and other representative entries render via `MovementCard`;
- group-specific programming override wins over movement default when one exists;
- current warning/safety introduction remains present;
- category selector remains functional and retains `value={selectedCategory}` contract;
- no duplicate canonical `stretchCategories` movement definition block remains in the page.

- [ ] **Step 2: Run RED.**

```bash
node --experimental-strip-types --test tests/mobility-movement-integration.test.mjs tests/member-tools-light-ui-contract.test.mjs
```

Expected: new integration test FAIL; existing light-shell requirements remain PASS.

- [ ] **Step 3: Refactor Mobility page to consume `mobilityGroups` + catalogue records.**

Keep the current route, hero, important-warning content and category UX. The page selects a group, resolves each entry’s movement ID, and passes the movement plus group-specific programming to the shared card. A missing referenced movement should be handled defensively rather than crashing the page, though the catalogue test should prevent it in committed code.

- [ ] **Step 4: Run GREEN plus movement suite, type-check and build.**

```bash
node --experimental-strip-types --test \
  tests/movement-catalog.test.mjs \
  tests/movement-resolver.test.mjs \
  tests/movement-ui-contract.test.mjs \
  tests/mobility-movement-integration.test.mjs \
  tests/member-tools-light-ui-contract.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/mobility/MobilityStretchPage.tsx lib/movements/mobilityGroups.ts tests/mobility-movement-integration.test.mjs tests/member-tools-light-ui-contract.test.mjs
git commit -m "feat: share movement guides with mobility"
```

---

### Task 7: Add end-to-end mobile browser verification and wire it into CI

**Files:**
- Create: `tests/browser/member-trainer-mobility.mjs`
- Modify: `.github/workflows/phase2-ci.yml`

**Browser fixture goals:**
- use a fictional active member and mocked `/api/member/auth/session`;
- mock GET/POST `/api/member/workout-plan` so no Supabase data is touched;
- verify one known legacy plan exercise resolves to an illustrated movement card;
- verify an unknown exercise remains visible with fallback content;
- verify technique details open on tap/click;
- visit `/mobility-stretch`, change category, open a known movement detail;
- test 390 × 844 viewport and assert `document.documentElement.scrollWidth <= innerWidth`;
- capture screenshots under `test-artifacts/member-ui/`.

- [ ] **Step 1: Create the browser script against the desired UI before all selectors are guaranteed to exist.**

Use the established pattern from `tests/browser/member-card-gyms.mjs`: start built Next.js on `127.0.0.1:3100`, launch Playwright Chromium headless, route APIs locally, capture page errors, and close browser/server in `finally`.

- [ ] **Step 2: Run against a current build and confirm RED for the new C5 expectations if any final selector/behaviour is missing.**

```bash
npm run build
node tests/browser/member-trainer-mobility.mjs
```

Expected: FAIL only for the intended C5 browser contract, not because of infrastructure/setup.

- [ ] **Step 3: Make the smallest UI/test-hook adjustments needed.**

Prefer semantic roles/text and stable `data-*` surface markers over brittle Tailwind-class selectors. Do not add production-visible debug content.

- [ ] **Step 4: Run GREEN.**

```bash
npm run build
node tests/browser/member-trainer-mobility.mjs
```

Expected: PASS with no `pageerror`, no horizontal overflow and screenshots saved.

- [ ] **Step 5: Add a dedicated CI step after existing member browser checks.**

```yaml
- name: Verify Trainer and Mobility movement guides in Chromium
  run: node tests/browser/member-trainer-mobility.mjs
```

The existing `member-ui-screenshots` artifact already captures `test-artifacts/member-ui`, so no new upload action is required.

- [ ] **Step 6: Run the complete CI-equivalent local verification.**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
node tests/browser/member-trainer-mobility.mjs
```

Then run at minimum:

```bash
node tests/browser/member-card-gyms.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add tests/browser/member-trainer-mobility.mjs .github/workflows/phase2-ci.yml
git commit -m "test: verify trainer and mobility movement guides"
```

---

### Task 8: Harden catalogue/assets and prove no Production-data dependency

**Files:**
- Modify as needed: `tests/movement-catalog.test.mjs`
- Modify as needed: `tests/movement-assets.test.mjs`
- Create: `tests/c5-no-database-migration.test.mjs`
- Modify only if tests expose real issues: `lib/movements/*`, `components/movements/*`

- [ ] **Step 1: Add a C5 scope guard.**

The guard should verify C5 runtime modules (`lib/movements`, `components/movements`) do not import Supabase/admin clients and that this feature did not add a C5 migration file. Do not attempt to prove repository-wide absence of Supabase; scope the assertion to C5 files/branch changes.

- [ ] **Step 2: Run the guard and fix only genuine scope leaks.**

```bash
node --experimental-strip-types --test tests/c5-no-database-migration.test.mjs
```

Expected after implementation: PASS.

- [ ] **Step 3: Run full unit/contract suite + type/build.**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit any guard/test additions.**

```bash
git add tests/c5-no-database-migration.test.mjs tests/movement-catalog.test.mjs tests/movement-assets.test.mjs lib/movements components/movements
git commit -m "test: harden C5 movement library boundaries"
```

If no production code needed changes, keep the commit test-only.

---

### Task 9: Expand diagrams to the rest of the current catalogue — only after owner visual approval

**Prerequisite:** Owner explicitly approves the first 12-diagram batch from Task 4.

**Files:**
- Modify: `lib/movements/catalog.ts`
- Create: remaining approved current-movement WebP assets under `public/movements/`
- Modify: `tests/movement-assets.test.mjs`

- [ ] **Step 1: Extend the asset test to require a diagram for every current C5 v1 movement selected for visual coverage.**

Do not require future/unknown AI exercises to have assets. The requirement applies only to the approved version-controlled current catalogue coverage target.

- [ ] **Step 2: Add the remaining exact `diagramAsset` references, then run RED.**

```bash
node --experimental-strip-types --test tests/movement-assets.test.mjs
```

Expected: FAIL listing the remaining missing WebP assets.

- [ ] **Step 3: Generate the remaining diagrams using the owner-approved Task 4 style.**

Preserve figure language, START/END treatment, arrow design, background, equipment accuracy and approximate composition. Do not introduce a second visual style mid-library.

- [ ] **Step 4: Review every generated asset for form/anatomy errors before committing.**

Where a movement is static or a stretch has minimal positional change, use two meaningful instructional states (setup and target position) rather than inventing motion.

- [ ] **Step 5: Run GREEN + build/browser regression.**

```bash
node --experimental-strip-types --test tests/movement-assets.test.mjs tests/movement-catalog.test.mjs
npx tsc --noEmit
npm run build
node tests/browser/member-trainer-mobility.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add public/movements lib/movements/catalog.ts tests/movement-assets.test.mjs
git commit -m "feat: complete current BGM movement artwork"
```

---

### Task 10: Preview release verification and owner QA

**Files:**
- No planned product-code files unless verification exposes a defect.
- Update only if useful after successful QA: PR description/release notes; do not rewrite the approved design requirements.

- [ ] **Step 1: Run the complete repository verification before pushing final implementation head.**

Match CI exactly where practical:

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Then run the new C5 browser test and any existing browser tests affected by touched shared surfaces.

- [ ] **Step 2: Verify branch diff.**

Confirm:
- no Supabase migration was added;
- no unrelated Wallet/payroll/staff changes;
- only intended code/tests/assets/docs/CI files changed;
- no user reference image was committed as a BGM asset;
- no secrets or generated temporary files are present.

- [ ] **Step 3: Push branch / open or update C5 PR and wait for GitHub CI.**

CI must be green on the exact C5 head before Preview QA is treated as release-candidate quality.

- [ ] **Step 4: Verify Vercel Preview points to the exact tested C5 commit and TEST/Preview environment, not Production.**

Do not change Production environment variables or Production Supabase.

- [ ] **Step 5: Owner QA on Android, one UI action at a time.**

QA sequence should cover:
- open Trainer;
- inspect a known illustrated exercise;
- expand technique/cues;
- confirm diagram human-figure quality and readability;
- generate/save/reload a plan;
- inspect an unknown fallback fixture only if exposed safely in Preview/test data;
- open Mobility & Stretch;
- switch a category;
- inspect a mobility diagram/detail;
- confirm no horizontal overflow or awkward text/image scaling.

- [ ] **Step 6: Fix any Preview-only defects with new failing tests first, rerun full verification, and obtain owner approval before merge.**

No merge to `main` and no Production deployment without explicit owner approval.

---

## Final Verification Checklist

Before declaring C5 complete:

- [ ] `node --experimental-strip-types --test tests/*.test.mjs` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] `node tests/browser/member-trainer-mobility.mjs` passes at mobile viewport.
- [ ] Relevant pre-existing member browser regression(s) pass.
- [ ] GitHub CI is green on the exact feature head.
- [ ] First 12 diagrams were explicitly visually approved before remaining artwork was generated.
- [ ] All required current-catalogue diagram assets exist and pass integrity checks.
- [ ] Legacy plan objects/strings render without database rewrite.
- [ ] Unknown movement fallback is visibly usable.
- [ ] Mobility reads canonical movement content from the shared library.
- [ ] No Production DB/schema migration exists for C5.
- [ ] No real-AI API/service/key was introduced.
- [ ] Preview deployment is verified before any merge.
- [ ] Owner explicitly approves merge/release.
