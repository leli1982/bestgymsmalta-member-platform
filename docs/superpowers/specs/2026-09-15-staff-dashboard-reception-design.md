# BestGymsMalta Staff Dashboard & Reception Workflow — Design

Date: 2026-09-15
Status: Approved design, pending implementation plan
Base production commit at design start: `befc91d2e26e99acb389dd39f5ad4bb614a49473`

## 1. Purpose

Replace the current menu-like `/staff` experience with a simple, always-open reception dashboard designed for the main computer at each BGM gym.

The staff portal must be understandable by staff with different language backgrounds, so the primary UX uses large icons, colour, obvious state changes and very short labels wherever possible.

Each gym uses one shared username/password for all staff at that location. The authenticated system account determines the gym server-side. Staff do not manually select which gym they are operating as.

This phase covers the Staff Dashboard, member search/browsing, the gym-specific incoming membership queue, application review/editing, card assignment, payment/activation, printing and auditability.

The public/tablet "New Member" form itself will be designed and implemented later, but this design defines the contract that form must submit into.

## 2. Existing Platform Capabilities to Preserve

The current platform already provides useful foundations that must be reused rather than replaced:

- shared system-user authentication through `bgm_system_users`
- gym-bound system accounts through `bgm_system_users.gym_id`
- system permissions through `bgm_user_permissions`
- pending membership applications in `bgm_membership_applications`
- application participants in `bgm_membership_application_members`
- official member/application photos
- membership card reservation and conflict prevention
- payment-triggered activation flow
- audit logging through `bgm_audit_log`
- barcode-based reception/card scanning
- server-side filtering that prevents a normal gym account from processing an application belonging to another gym

No existing member-login, member-card, member-check-in, passport, trainer or other member-app behaviour should be changed by this work.

## 3. Staff Login Model

### 3.1 Shared gym credentials

Each gym has one shared system account, for example:

- Birkirkara Fitness staff account
- Marsa Fitness staff account
- Sliema Fitness staff account

The account has a fixed `gym_id`.

After login, the server session is authoritative. The browser must never be allowed to override the gym context by passing an arbitrary `gymId` to a privileged endpoint.

### 3.2 Staff identity vs shared account

The shared gym account identifies the location/device context, not the individual employee.

Where individual accountability matters, the interface explicitly asks for the employee's name. In this phase that is mandatory when confirming **Payment Received**.

The payment staff name is stored in the activation/audit record alongside:

- shared system user ID
- gym ID
- application ID
- server timestamp

### 3.3 Super Admin

Super Admin may retain network-wide visibility and management capability. Normal gym accounts remain strictly scoped to their own gym.

This phase must not weaken existing permission checks.

## 4. Main `/staff` Dashboard

After a successful login, `/staff` becomes the primary reception workspace rather than a menu of separate feature cards.

### 4.1 Visual principles

- desktop reception computer is the primary target
- responsive enough for tablet use
- large controls
- icon-first navigation
- minimal text
- high contrast
- no hidden hamburger menu for core actions
- no deep navigation for daily tasks
- very limited scrolling at normal desktop sizes
- BGM light business UI with white/light-grey surfaces and orange accents
- green = valid/success
- red = expired/problem
- orange = action waiting/attention

### 4.2 Header

The header must make the current gym unmistakable, for example:

**BIRKIRKARA FITNESS — STAFF**

Header contains:

- BGM identity/logo
- current gym name
- connection indicator
- current date/time display
- waiting applications badge when applicable
- Log Out action

Date/time shown in the UI uses Malta local time (`Europe/Malta`).

### 4.3 Operational shortcuts

Use large icon tiles with short labels:

- Members
- New Member
- Card / Reception
- Sundries
- Bar
- Punch Clock (future; not implemented in this phase)

The New Member tile becomes visually prominent when applications are waiting and shows the count, for example:

**3 WAITING**

### 4.4 Default focus

The default dashboard focus is Member Search because this is expected to be the most common reception action.

## 5. Member Search & Member Browser

### 5.1 Search box

A single large search field should support:

- full or partial member name
- member number
- ID card / national ID number
- mobile / phone
- email

Barcode/member-card scanning may feed the same lookup path where technically appropriate.

### 5.2 Filters

Three large visual filters appear below the search field:

- ALL
- ACTIVE
- EXPIRED

Filtering must be server-supported, not client-only filtering of an arbitrary partial result set.

Membership validity must use the platform's canonical membership rules so search results do not disagree with barcode reception/check-in behaviour.

### 5.3 Results

Each member result shows at minimum:

- official photo or clear placeholder
- member name
- member number
- membership expiry
- large status badge

Status presentation:

- ACTIVE — green
- EXPIRED — red
- other invalid/inactive states — red or warning treatment consistent with existing reception rules

### 5.4 Member detail panel

Clicking/tapping a member opens a simple detail panel with:

- photo
- full name
- member number/card identifier
- membership status
- expiry date
- phone/mobile
- email
- ID number
- enrollment/home gym where available

For this phase, established member details are read-only from this browser. Editing existing members is a later management decision and is intentionally kept separate from the new-member correction flow.

## 6. New Membership Submission Contract

The later tablet New Member page must submit an application into the existing membership-application pipeline.

A successful submission must contain or reference:

- selected enrollment gym
- member personal details
- contact details
- ID number
- date of birth where required
- address fields
- emergency/next-of-kin details
- membership type
- membership duration
- requested/start date where applicable
- member photo
- application kind (`new`, with renewal handled by existing compatible architecture where applicable)

The server must generate the submission timestamp. The tablet must not be trusted to provide an authoritative timestamp.

### 6.1 Automatic submission date/time

Every new application receives an automatic server timestamp when successfully persisted.

Display format example:

`15 Sep 2026 · 14:32`

The authoritative stored value uses the database/server timestamp. UI rendering uses `Europe/Malta`.

The timestamp is non-editable.

### 6.2 Delivery guarantee

The application is considered submitted only after the database write succeeds.

Realtime notification happens after persistence. This prevents the staff computer from seeing a popup for an application that was never actually stored.

## 7. Gym-Specific Realtime Queue

### 7.1 Recommended transport

Use Supabase Realtime to notify the staff dashboard of new/changed pending applications.

Realtime is a notification mechanism; the database remains the source of truth.

### 7.2 Gym isolation

A normal gym staff session only reacts to applications whose `enrollment_gym_id` matches the authenticated account's `gym_id`.

Example:

Tablet submission selects Birkirkara Fitness -> application is saved with Birkirkara gym ID -> Birkirkara Staff Dashboard receives the event -> other gyms do not show it.

Server/API authorization must enforce the same gym boundary even if a client attempts to request another gym's application manually.

### 7.3 Recovery after refresh/disconnection

The queue is never browser-memory-only.

When `/staff` loads or reconnects it fetches unfinished applications for the authenticated gym from the database and rebuilds the Waiting queue.

Therefore pending forms survive:

- browser refresh
- accidental tab closure
- computer restart
- temporary internet loss
- Realtime reconnect

### 7.4 Arrival behaviour

When a new application arrives for the current gym:

1. play one short notification sound
2. increment the Waiting count
3. automatically open the newest application as a large modal/popup if the staff user is not already actively processing another application

If staff is already working on an application, that application remains open and undisturbed. New arrivals join the Waiting queue.

### 7.5 Waiting queue

Waiting entries show concise information such as:

- NEW / submitted time
- member name
- selected gym
- card assignment state
- application reference

Example:

**NEW — 14:32**  
John Borg  
Birkirkara Fitness  
Card not assigned

Newest submissions should be easy to identify, but staff must be able to select any waiting item.

Nothing disappears from the queue merely because a popup was closed or minimized.

## 8. Application Review Popup

The incoming membership popup is the central processing surface.

### 8.1 Layout

Use a large desktop modal/panel with:

- large member photo on the left or clearly visible upper section
- application reference and submission date/time
- clear current workflow status
- editable application details grouped into icon-led sections

Suggested sections:

- Personal
- Contact
- Membership
- Emergency Contact

### 8.2 Editable fields

Staff can correct all submitted member/application fields before activation, including fields such as:

- first name
- last name
- ID number
- date of birth
- address
- postcode/town
- phone/mobile
- email
- next of kin
- membership type
- duration
- start date
- other fields present on the submitted application

The corrected values become the authoritative values used to create/update the final member record.

### 8.3 Original submission preservation

The original values must remain auditable.

Each staff correction records enough information to establish:

- application ID
- field(s) changed
- original/before value
- corrected/after value
- system user/shared gym account
- gym context
- server date/time

Use the existing audit architecture where practical rather than creating a disconnected logging system.

Individual staff name is not required for every keystroke/edit; the shared system account plus gym and timestamp identify the editing session. Payment/activation requires the individual staff name separately.

## 9. Primary Application Actions

The bottom of the application popup uses three consistently positioned large actions.

### 9.1 SCAN CARD

Icon-led card/barcode action.

When selected:

- scanner input receives focus
- staff scans the physical BGM card
- barcode is normalized using existing card logic
- server verifies the barcode is not active/reserved for another member/application
- successful scan reserves the card against this application participant

Success state becomes visually obvious:

**CARD ASSIGNED ✓**

with green styling and the assigned card/member number visible.

If the card is already assigned or reserved elsewhere, show a clear blocking error and do not overwrite the existing assignment.

Existing card reservation/conflict logic must be reused.

### 9.2 PAYMENT RECEIVED

This action remains disabled until all activation prerequisites are satisfied.

For a new one-person membership, prerequisites are at minimum:

- required member details valid
- official photo exists
- card successfully assigned/reserved

When clicked:

1. open a very small prompt/modal asking for **Staff Name**
2. require a non-empty staff name
3. persist any unsaved staff corrections
4. revalidate card/photo/application state server-side
5. record payment received timestamp automatically
6. record staff name
7. activate the membership immediately
8. finalize the reserved card onto the member
9. create/update the final member record using corrected values
10. record activation timestamp automatically
11. remove the completed application from the active Waiting queue

There is no separate **Activate Member** button.

**Payment Received = activation.**

### 9.3 Automatic payment/activation date/time

The payment/activation time is a server-generated, non-editable timestamp.

UI and print views display it in `Europe/Malta`.

### 9.4 PRINT FORM

The Print Form action is available before or after payment/activation.

Prefer a dedicated print-friendly application route/view rather than attempting to print the dashboard modal itself. This makes reprinting stable and predictable.

The print layout is A4 and includes:

- BGM branding
- application reference
- submitted date/time
- member photo
- final/corrected personal details
- contact details
- membership details
- selected/enrollment gym
- assigned member/card number if available
- payment/activation date/time if already activated
- payment staff name if already activated
- Member Signature field
- Member Signature Date field
- Staff Signature field
- Staff Signature Date field
- processed-at gym line

Use print-specific CSS so navigation, buttons and dashboard chrome do not appear on paper.

Opening the print view must create an audit event with application ID, system user, gym and server timestamp. Re-opening it creates a reprint audit event. The system does not claim that the physical printer completed successfully because browsers do not provide a reliable print-completion signal.

## 10. Completion Behaviour

After successful Payment Received / activation:

1. show a large green success state with **MEMBERSHIP ACTIVE**
2. show member photo
3. show member name
4. show assigned member/card number
5. show activation date/time
6. after a short confirmation period, close the completed application
7. if another application is waiting, open the next queued application; otherwise return to the Staff Dashboard

No completed application should remain in the active Waiting count.

## 11. Application State Model

The UI may simplify labels for staff, but the data flow should clearly distinguish states.

Use existing statuses where compatible and evolve only where required. Conceptually the workflow is:

1. Submitted
2. Card Assigned / Awaiting Payment
3. Payment Received / Active

Cancelled remains available for administrative handling where supported, but no new cancellation UX is required in the first Staff Dashboard implementation unless existing behaviour requires it.

The implementation plan must map these concepts onto the existing `bgm_membership_applications.status` values rather than inventing parallel state storage.

## 12. Audit Requirements

Important events must be reconstructable later.

Audit at minimum:

- application submitted
- staff corrections saved
- card assigned/reserved
- card assignment rejected because of conflict where useful for diagnostics
- payment received
- membership activated
- print view opened / reprint requested

For each audit event, retain relevant context such as:

- system user ID
- gym ID
- application ID
- application member/participant ID where relevant
- final member ID where relevant
- staff name when supplied
- server timestamp
- before/after data for edits

The original tablet submission must not be silently overwritten without an audit trail.

## 13. Security & Authorization

### 13.1 Server-side gym scope

Every sensitive application endpoint must verify the authenticated system context.

Normal gym users may only:

- list pending applications belonging to their own gym
- view an application belonging to their own gym
- edit an application belonging to their own gym
- reserve/assign cards for an application belonging to their own gym
- activate an application belonging to their own gym
- print an application belonging to their own gym

Client-side filtering is never sufficient authorization.

### 13.2 Service-role handling

Supabase privileged/service credentials remain server-only and must never be exposed to the browser.

### 13.3 Realtime security

Realtime subscriptions must not become a way to leak application/member details across gyms. Prefer narrowly scoped database events and/or server-mediated fetching where appropriate. Receiving a Realtime event never replaces API authorization when fetching the full application.

### 13.4 Shared account limitations

Because staff credentials are deliberately shared per gym, the system cannot infer the individual employee from authentication alone. The UI therefore explicitly captures staff name for payment/activation.

## 14. Connectivity & Failure Handling

### 14.1 Realtime disconnected

If Realtime disconnects:

- show a connection warning/indicator
- automatically attempt normal reconnect through the client library
- refetch the pending queue on reconnect or window focus so missed events are recovered

Realtime loss must not lose applications because the database is authoritative.

### 14.2 Card assignment failure

If scanning/reservation fails:

- keep the application open
- preserve staff edits locally where safe
- show a clear error
- do not enable Payment Received

### 14.3 Activation failure

If payment activation fails server-side:

- do not show success
- do not remove the application from the queue
- do not assume payment/activation completed
- show a prominent retry/error state
- rely on server/database state when retrying to avoid duplicate activation

Activation endpoints must be designed to be safe against accidental double submission.

### 14.4 Browser refresh during editing

Persisted application state is recoverable from the server. Unsaved field edits may be lost on a hard refresh unless the implementation plan chooses an explicit draft-save mechanism. The initial implementation should save corrections deliberately before or during card/payment actions rather than introduce complex local autosave unless needed.

## 15. Member Search API Changes

The existing member search should be extended rather than replaced.

Required additions:

- ID number search
- server-side Active/Expired filtering
- enough fields to render the reception result/detail cards
- official photo access only when the authenticated staff permission allows it

Avoid returning unnecessary sensitive fields in list results.

The member browser must remain system-auth protected.

## 16. Realtime/Data Changes Expected

Implementation is likely to require limited schema/API evolution, but this design intentionally reuses the current membership application tables.

Likely needs include:

- application edit/update endpoint(s)
- immutable/before-after audit entries for corrections using existing audit infrastructure
- Realtime publication/subscription support for membership application changes
- robust queue query by authenticated gym and pending statuses
- print-view endpoint/route
- possible metadata needed to identify payment staff name and final processing details if current fields are insufficient

Any schema changes must be minimal, migration-backed, RLS/security-reviewed and verified with Supabase advisors before production merge.

## 17. Accessibility & Language-Minimizing UX

Because staff may have different first languages:

- pair all important text actions with recognizable icons
- keep labels to one or two words where possible
- keep button locations stable
- use the same colours consistently
- never communicate a critical state using colour alone; pair colour with icon/text
- use large click/tap targets
- avoid explanatory paragraphs in the daily workflow
- use clear confirmations such as `CARD ASSIGNED`, `PAYMENT RECEIVED`, `MEMBERSHIP ACTIVE`

## 18. Testing Requirements

Implementation must use TDD for new behaviour.

At minimum verify:

### Authentication / gym isolation

- unauthenticated users cannot use Staff Dashboard APIs
- a Birkirkara account cannot fetch/process a Marsa application
- Super Admin behaviour remains intentionally network-wide

### Member search

- search by name
- search by member number
- search by ID number
- search by phone/mobile
- search by email
- Active filter
- Expired filter
- official photo permission behaviour

### Queue / realtime recovery

- pending list only includes authenticated gym
- newly submitted application appears in matching gym queue
- other gyms do not receive/display it
- page reload restores pending applications
- multiple submissions queue without replacing the application currently being processed

### Editing / audit

- staff can correct application fields
- corrected values become final activation values
- original values remain reconstructable through audit records
- another gym cannot edit the application

### Card assignment

- valid unused card reserves successfully
- duplicate/conflicting card is rejected
- payment remains blocked without valid card

### Payment / activation

- staff name is required
- payment action revalidates prerequisites server-side
- payment activation finalizes the card
- final member data uses corrected application values
- activation timestamps are server generated
- repeated/double activation is safe and does not create duplicate active memberships/cards

### Printing

- print route is authorization protected
- normal gym user may print only own-gym application
- print view contains final values and signature fields
- opening/re-opening the print view creates the appropriate audit event
- print CSS excludes operational UI

### Regression

- existing member app tests remain green
- existing card/barcode reception behaviour remains green unless intentionally integrated into the new dashboard
- Next.js build and TypeScript checks pass
- browser verification covers core Staff Dashboard workflow

## 19. Implementation Boundaries

### In scope

- Staff Dashboard redesign
- icon-first navigation
- shared gym login presentation using current auth model
- member search and Active/Expired filtering
- member detail viewing
- pending membership Waiting queue
- Supabase Realtime arrival notification
- notification sound
- large application popup
- staff correction of submitted application data
- original-value audit history
- card scan/reservation
- Payment Received -> immediate activation
- staff-name capture for payment
- automatic submission/payment/activation date-time
- A4 print form and signature fields
- robust queue recovery

### Explicitly out of scope for this implementation

- building the public/tablet New Member form itself (next project slice)
- NFC
- Punch Clock functionality
- redesigning the full Admin/Management Portal
- editing established members from the normal search/detail panel
- individual staff login accounts
- changing the existing member app's auth/business logic

## 20. Acceptance Criteria

This feature is complete when all of the following are true:

1. A gym can log in with its shared username/password and the gym identity is fixed server-side.
2. `/staff` opens as a simple icon-led reception dashboard suitable to remain open all day.
3. Staff can find members by name, member number, ID number, phone/mobile or email and filter All/Active/Expired.
4. A membership application for Birkirkara is visible/notified at Birkirkara and not at unrelated gym sessions.
5. A new application produces one notification sound and a prominent popup when appropriate.
6. Multiple incoming applications are preserved in a visible Waiting queue.
7. Refresh/reconnect rebuilds the queue from the database.
8. Staff can review and correct all submitted member/application data before activation.
9. Original submission values and corrections remain auditable.
10. Submission date/time is automatic and non-editable.
11. Scan Card reserves a valid unused physical card and rejects conflicts.
12. Payment Received is disabled until required photo/card/application prerequisites are valid.
13. Payment Received asks for staff name and immediately activates the membership after server-side revalidation.
14. Payment/activation date-time is automatic and non-editable.
15. Successful activation finalizes the card and final member record using corrected values.
16. A green MEMBERSHIP ACTIVE confirmation is shown, then the next queued member is surfaced.
17. Print Form produces an A4 form containing final details, timestamps, photo, application reference and member/staff signature fields.
18. Opening or re-opening Print Form creates a print/reprint audit event.
19. Normal gym accounts cannot access or process another gym's application through direct API calls.
20. Existing member-facing features and existing critical barcode/card rules continue to work.
