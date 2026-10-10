# C5 Movement Library & Visual System — Design

**Date:** 10 October 2026  
**Branch:** `feature/ai-trainer-visual-library-c5`  
**Base:** `main` at `678136c2cdd669d33cec53371b541edea17adc2d`  
**Status:** Design approved in conversation; written spec awaiting owner review before implementation planning.

## 1. Purpose

C5 upgrades the BestGymsMalta member experience so Trainer exercises and Mobility & Stretch movements are no longer text-only. The app will gain a shared, reusable movement library with consistent instructional content and curated BGM diagrams.

The first release deliberately keeps the existing workout-generation logic. A real generative-AI model is deferred to a later phase. C5 must nevertheless be designed so a future AI model can generate personalised exercises freely without being constrained to a hard whitelist.

The movement library is therefore an **enrichment and presentation layer**, not a restriction on what a future AI Trainer may prescribe.

## 2. Success criteria

C5 is successful when:

1. Existing Trainer plans still generate, save and load as before.
2. Known Trainer exercises resolve to a shared movement record and gain an instructional diagram and richer guidance.
3. Existing saved plans that contain only exercise names can gain the same visual treatment at runtime without rewriting historical rows.
4. Mobility & Stretch uses the same movement model and visual components instead of owning a separate hard-coded catalogue.
5. Unknown/unmatched exercises remain usable as text and never cause a plan to fail.
6. The first approved movement set has consistent, curated BGM instructional diagrams using human figures rather than stick figures.
7. The architecture can later accept real AI-generated exercise names and structured plans without redesigning the member-facing UI.
8. C5 v1 requires no Production database migration.

## 3. Current state

### Trainer

The current Trainer is implemented in `components/trainer/AiTrainer.tsx` and `app/api/member/workout-plan/route.ts`.

The workout API currently uses deterministic application logic and hard-coded exercise lists. Exercises are represented mainly as:

- `name`
- `sets`
- `reps`
- `notes`

The current generator supports push, pull, legs, upper, lower, full-body, conditioning and recovery patterns.

### Mobility & Stretch

`components/mobility/MobilityStretchPage.tsx` currently contains its own hard-coded movement catalogue. Items include fields such as:

- name
- area
- hold/reps
- instructions
- note

It is separate from the Trainer exercise definitions and has no shared movement identity.

## 4. Scope

### C5 v1 includes

- one shared movement type/model
- one version-controlled movement registry
- stable movement slugs/IDs
- aliases for name resolution
- current Trainer exercises seeded into the registry
- current Mobility & Stretch movements seeded into the registry
- reusable movement preview/detail UI
- curated instructional diagrams for the current movement set, produced incrementally in approved batches
- runtime resolver for current and legacy workout-plan entries
- Trainer integration
- Mobility & Stretch integration
- fallback rendering for unknown movements
- asset-integrity and compatibility tests
- mobile/browser regression checks

### C5 v1 does not include

- connection to a real AI model
- live AI image generation in the member app
- forcing generated plans to use only library movements
- Supabase-admin management of the exercise catalogue
- Production schema changes
- rewriting historical workout-plan rows
- advanced exercise authoring/admin tools
- medical diagnosis or rehabilitation prescriptions

## 5. Core architecture

The long-term flow is:

`Member input -> plan generator -> exercise entries -> movement resolver -> enriched movement UI`

For C5 v1, `plan generator` remains the current deterministic workout generator.

For a later real-AI phase, the generator can be replaced with a model-backed service while the resolver and UI remain unchanged.

### 5.1 Shared movement model

Each approved movement will have a stable slug and structured metadata. The exact TypeScript shape may evolve during implementation, but it must cover these concepts:

- `id` / `slug`
- `name`
- `aliases`
- `type`
  - strength
  - machine
  - dumbbell
  - cable
  - bodyweight
  - conditioning
  - mobility
  - stretch
  - warmup
  - cooldown
- `bodyRegions`
- `primaryMuscles`
- `equipment`
- `difficulty`
- `description`
- `startPosition`
- `movementInstructions`
- `coachingCues`
- `commonMistakes`
- `safetyNotes`
- default programming guidance where appropriate
- `diagramAsset`
- optional search/filter tags

This model is for display, discovery and enrichment. It must not imply that future plan generation can only select these movements.

### 5.2 Version-controlled registry first

C5 v1 stores the movement registry in application code/data rather than a new database table.

Recommended structure:

- `lib/movements/types.ts`
- `lib/movements/catalog.ts`
- `lib/movements/resolveMovement.ts`

This keeps the first rollout auditable, reviewable and low risk. The catalogue can later move to Supabase or a content-management interface behind the same consumer-facing types if required.

## 6. Movement identity and resolution

### 6.1 Stable slugs

Movements use readable stable slugs such as:

- `lat-pulldown`
- `romanian-deadlift`
- `leg-press`
- `90-90-hip-switch`
- `cat-cow`

New workout-plan entries may include a movement reference where practical, while retaining the existing name/sets/reps/notes fields for compatibility.

### 6.2 Legacy-plan resolver

Existing saved plans are not rewritten.

When a plan is rendered, the resolver will:

1. use a stored movement ID/slug if present;
2. otherwise normalize the exercise name;
3. match canonical names and approved aliases;
4. return the matching movement record when confident;
5. return `null` when no approved match exists.

Examples:

- `Lat Pulldown` -> `lat-pulldown`
- `Dumbbell Biceps Curl` -> canonical curl movement where explicitly configured
- `Dumbbell Curl` -> same canonical movement only if the alias is intentionally approved

There must be no fuzzy substitution that silently changes the exercise into a materially different movement.

## 7. Unknown exercise behaviour and future AI freedom

An unmatched exercise must remain fully usable.

If no movement record resolves, the Trainer still displays:

- exercise name
- sets/reps/duration
- existing notes

The UI may show a neutral exercise icon or `Visual guide coming soon`, but must never reject the plan, hide the exercise, or substitute a different movement merely to obtain a diagram.

This rule is essential for the later real-AI phase. A future model may generate exercises or variations not yet present in the BGM visual library.

Later AI flow:

`Member questionnaire -> BGM safety/business rules -> real AI model -> structured workout JSON -> validation -> movement resolver -> saved plan`

Known movements gain curated visuals automatically. Unknown movements still render normally and can later receive approved assets.

## 8. Diagram design system

### 8.1 Approved visual direction

The BGM instructional artwork will use simplified **human fitness figures**, not stick figures.

The approved visual language is inspired by conventional clean fitness-instruction illustration, including the user-provided reference image, but final BGM assets must be original and must not trace or copy that image.

Visual characteristics:

- recognisable human anatomy and body proportions
- faceless or minimally featured human figure
- clean outlined/vector-like illustration style
- simple gym clothing
- male or female figures are both acceptable
- consistent style across the library
- uncluttered neutral background
- mobile-readable poses
- no photorealistic scene backgrounds
- no decorative clutter

### 8.2 Two-state diagram

Each movement uses a clear instructional composition:

`START -> movement direction -> END`

The final reviewed asset will contain:

- start pose
- end pose
- directional arrow(s)
- START/END labels
- optional subtle target-region highlighting where useful

The long instructional text should remain live UI text rather than being baked into the artwork, so wording can change without regenerating the image.

### 8.3 Asset ownership and consistency

Diagrams are curated static BGM assets bundled with the application, not generated live for every member request.

Benefits:

- no per-view generation cost
- deterministic visual output
- reviewable exercise form
- consistent style
- faster member experience
- no visual changes between members or sessions

A single approved movement diagram is reused everywhere that movement appears.

Recommended asset location:

`public/movements/<slug>.*`

The final file format should balance crisp mobile display and payload size; implementation may use optimized WebP/PNG or another browser-safe static format after visual QA.

## 9. Movement UI

### 9.1 Compact plan card

Trainer workout days remain easy to scan. A known movement card shows:

- movement name
- plan-specific sets/reps/time/rest
- diagram preview
- concise coaching cue
- action to reveal full technique guidance

The diagram should be visible without forcing the member to navigate to another page.

### 9.2 Expanded movement detail

Expanding a movement reveals:

- full instructional diagram
- start position
- movement steps
- coaching cues
- common mistakes where useful
- safety warning where relevant
- body area/equipment metadata where helpful

The detail interaction must be designed for mobile first and must not create horizontal overflow.

### 9.3 Shared component

Trainer and Mobility & Stretch use the same underlying movement presentation components.

Recommended component boundary:

- `components/movements/MovementCard.tsx`
- `components/movements/MovementDetail.tsx`

The plan supplies plan-specific programming. The movement record supplies stable instructional content and artwork.

## 10. Trainer integration

The current workout-generation behaviour is preserved in C5 v1.

The current hard-coded plan logic may continue selecting exercises as it does today, but generated entries should reference a movement slug when an approved mapping exists.

The member UI resolves both:

- new plan entries with movement IDs; and
- old plan entries containing only names.

C5 must not make a real-AI claim about the deterministic generator. Product/grant documentation should distinguish the current rules-based planning implementation from the future model-backed AI phase.

## 11. Mobility & Stretch integration

The current mobility catalogue will be moved into the shared registry.

`MobilityStretchPage` will no longer own duplicate movement definitions. It will filter shared movement data by category/body area and render the same reusable movement UI as the Trainer.

The existing page intent remains:

- full body
- chest
- back
- shoulders
- arms
- legs
- hips
- neck
- post-workout
- desk/stiffness

The implementation may preserve these as display/filter groupings while the underlying movement definitions remain canonical and shared.

## 12. Initial movement content

The first content set is derived from movements already present in the application, not a large new exercise expansion.

Representative Trainer movements include:

- Chest Press Machine
- Incline Dumbbell Press
- Shoulder Press Machine
- Cable Lateral Raises
- Triceps Rope Pushdown
- Lat Pulldown
- Seated Cable Row
- Chest-Supported Row
- Face Pulls
- Dumbbell Biceps Curl / Dumbbell Curl aliases where appropriate
- Leg Press
- Goblet Squat
- Romanian Deadlift
- Dumbbell Romanian Deadlift where treated distinctly
- Leg Curl Machine
- Standing Calf Raise
- Walking Lunges
- Leg Extension
- Plank
- Cable Crunch
- Treadmill Incline Walk
- Kettlebell Deadlift
- Battle Ropes
- Medicine Ball Slams
- Bike Finisher / Easy Bike where appropriate
- Band Pull-Aparts
- Bodyweight Squat
- Dynamic Hip Mobility

Representative Mobility & Stretch movements include:

- World’s Greatest Stretch
- Standing Forward Fold
- Cat-Cow Stretch
- Child’s Pose
- Doorway Chest Stretch
- Wall Chest Opener
- Hands-Behind-Back Chest Stretch
- Child’s Pose Lat Reach
- Thread the Needle
- Cross-Body Shoulder Stretch
- Overhead Shoulder Stretch
- Wall Angels
- Biceps Wall Stretch
- Overhead Triceps Stretch
- Forearm Stretch
- Standing Quad Stretch
- Hamstring Stretch
- Calf Wall Stretch
- Half-Kneeling Hip Flexor Stretch
- Figure Four Stretch
- 90/90 Hip Switch
- Side Neck Stretch
- Chin Tucks
- Upper Trap Stretch
- post-workout and desk/stiffness variants that can reuse canonical movement records where they are genuinely the same movement

Exact deduplication is an implementation task. Same-name/same-form movements should share one record; materially different variants must remain separate records.

## 13. First diagram approval batch

Do not produce the entire library before proving the visual system.

The first representative diagram batch should cover a cross-section of equipment and movement types:

1. Chest Press Machine
2. Lat Pulldown
3. Leg Press
4. Romanian Deadlift
5. Goblet Squat
6. Seated Cable Row
7. Shoulder Press Machine
8. Dumbbell Curl
9. Triceps Pushdown
10. 90/90 Hip Switch
11. Cat-Cow
12. Half-Kneeling Hip Flexor Stretch

The owner reviews this batch for:

- human-figure style
- pose accuracy
- arrow clarity
- mobile readability
- START/END composition
- consistency across male/female figures

Only after the style is approved should the remaining current movement set be produced.

## 14. Safety and content rules

### 14.1 General fitness scope

C5 provides general exercise guidance, not diagnosis or medical treatment.

Movement records may contain short safety notes such as:

- stop if sharp pain occurs
- use a controlled range of motion
- ask a coach when unsure about technique

### 14.2 Mobility

Mobility/stretch instructions should emphasize:

- controlled movement
- comfortable range
- no forced range
- stopping for sharp pain, numbness, dizziness or unusual symptoms

### 14.3 Visuals

Diagrams must prioritise clear form over artistic detail. Equipment and limb placement should be recognisable enough to avoid misleading instruction.

## 15. Data and Production safety

C5 v1 is application code and static assets only.

- no Production Supabase migration is required
- no existing member records are rewritten
- no saved workout plans are bulk-updated
- no Google Wallet or membership-access configuration is changed
- current C1 active/grace/locked access rules remain untouched

Any later proposal to persist the movement catalogue in Supabase is a separate schema change requiring the normal explicit Production approval process.

## 16. Testing requirements

### 16.1 Movement resolver tests

Cover:

- canonical name resolution
- approved aliases
- normalization of case/spacing where safe
- no false match for materially different movements
- unknown exercise returns no movement rather than throwing

### 16.2 Legacy plan compatibility

Existing saved-plan payloads containing only `name`, `sets`, `reps`, and `notes` must continue rendering.

A legacy known name should gain enrichment at runtime without requiring database mutation.

### 16.3 Fallback tests

Unknown exercises must render the original plan information and must not crash or disappear.

### 16.4 Mobility tests

Cover:

- existing categories remain available
- shared movement records render correctly
- movement detail opens/closes correctly
- hold/repetition text remains correct

### 16.5 Asset integrity

Every movement that declares a diagram must reference an asset present in the application bundle.

Missing assets must degrade gracefully rather than breaking a plan.

### 16.6 Browser/mobile regression

Verify at minimum:

- Trainer generate/save/load
- current saved plan rendering
- known movement visual enrichment
- unknown movement fallback
- Mobility category switching
- diagram scaling on narrow Android-sized screens
- no page-level horizontal overflow
- accessible detail controls

## 17. Implementation sequence

C5A should be implemented in this order:

1. shared movement types/model
2. initial registry seeded from current Trainer and Mobility content
3. resolver and alias behaviour with tests
4. reusable movement card/detail UI
5. first 12-diagram approval batch
6. Trainer runtime enrichment and new-plan movement references
7. Mobility & Stretch conversion to shared registry
8. compatibility/regression/browser tests
9. remaining current-movement diagrams after visual approval
10. Preview deployment and owner QA before any merge to `main`

## 18. Future real-AI phase

The future model-backed Trainer is intentionally outside C5 v1, but C5 must not block it.

When introduced, real AI should:

- receive member-selected goals, experience, schedule, focus, equipment/availability and relevant non-medical limitations
- generate structured workout-plan JSON server-side
- be validated before persistence
- remain free to return exercises not already in the BGM movement registry
- benefit from the movement resolver when a known visual exists
- use graceful text fallback for genuinely new movements
- record model/version metadata so AI-generated plans are auditable

API credentials must remain server-side secrets. Usage/cost controls and privacy handling belong to that later integration design.

## 19. Explicit design decisions

The following decisions are locked for C5 v1:

1. Real AI integration is postponed.
2. Current Trainer generation logic remains functional.
3. The movement library enriches plans; it does not whitelist future AI output.
4. Trainer and Mobility share one canonical movement registry.
5. Existing saved plans are not rewritten.
6. Unknown exercises remain usable.
7. Static curated BGM diagrams are used instead of live image generation.
8. Diagrams use illustrated human figures, not stick figures.
9. Both male and female instructional figures are acceptable within one consistent visual style.
10. Diagrams use a START -> END two-state presentation with directional arrows.
11. The first movement set comes from content already present in the app.
12. The first diagram batch is reviewed before scaling the artwork to the full current movement set.
13. No Production database migration is part of C5 v1.

## 20. Definition of done

C5 v1 is complete when:

- the shared movement registry is the canonical source for current movement instructional content;
- current Trainer plans remain functional and known movements display approved visuals;
- old saved plans are enriched without being rewritten;
- Mobility & Stretch renders from the shared registry;
- unknown exercise fallback is proven;
- the current in-app movement set has approved BGM diagrams or explicitly safe fallbacks;
- automated tests and mobile browser checks pass;
- a Preview deployment is owner-validated;
- no Production data/schema mutation was required.
