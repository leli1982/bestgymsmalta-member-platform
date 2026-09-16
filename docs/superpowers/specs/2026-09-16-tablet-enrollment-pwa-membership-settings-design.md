# BestGymsMalta Tablet Enrollment PWA, Membership Settings & Offline Continuity — Design

Date: 2026-09-16
Status: Approved design, pending implementation plan
Depends on: `docs/superpowers/specs/2026-09-15-staff-dashboard-reception-design.md` and the current `feature/staff-dashboard-reception` implementation

## 1. Purpose

Build the next BestGymsMalta membership-enrollment slice on top of the Staff Dashboard & Reception workflow.

This slice adds:

- a public, gym-specific, installable tablet/PWA registration flow for **new members only**;
- reuse of the same registration form inside the Staff Portal for staff-created new memberships;
- staff-only renewal handling, including conversion of returning-member tablet submissions into renewals;
- centrally managed membership pricing;
- controlled discount codes;
- versioned Gym Rules, declarations and consent text;
- one-A4-page-per-member printed membership forms;
- required document-verification gates for student/couples/minor cases;
- staff-side deferred-photo support;
- business-continuity/offline enrollment for staff terminals without locally allocating permanent member numbers.

The goal is to make enrollment practical at every BGM gym while keeping membership identity, pricing, cards, activation and auditability centrally controlled.

## 2. Core Product Boundaries

### 2.1 Tablet/PWA

The public tablet flow is **NEW MEMBER only**.

It does not expose renewal as a customer option.

### 2.2 Staff Portal

The Staff Portal continues to offer two explicit paths:

- **NEW MEMBERSHIP**
- **RENEWAL**

Staff-created new memberships reuse the same registration form and validation rules as the tablet flow wherever practical.

Renewals remain staff-only.

### 2.3 No NFC in this slice

The platform continues to use the approved barcode/physical-card architecture for launch. NFC remains out of scope.

### 2.4 Production safety

Implementation must occur on a feature branch with normal Vercel auto-deploy disabled for that branch. GitHub CI/local verification is used during development. A single deliberate Preview is created only at a meaningful checkpoint and only when Vercel storage permits it. Production remains untouched until explicit visual approval.

Before creating the new implementation branch, the Vercel branch guard must be extended from the currently protected `feature/staff-dashboard-reception` branch to the chosen enrollment implementation branch so branch creation/push cannot create an accidental Preview.

## 3. Gym-Specific Public Routes

Each gym has a stable public registration route, for example:

- `/join/birkirkara`
- `/join/talqroqq`
- `/join/pembroke`
- `/join/sliema`

The route slug determines the enrollment gym.

The page must clearly display the gym identity, for example:

**BIRKIRKARA FITNESS — MEMBER REGISTRATION**

The applicant cannot change the gym from the form.

The server validates that the slug maps to an active BGM gym before accepting a submission.

The routes are intentionally public. There is no hidden kiosk key in this phase because no submission can create an active member without staff review, verification, payment and activation.

Public submission/duplicate-check endpoints should still use basic abuse/rate limiting and expose only the minimum response needed by the form.

## 4. Installable PWA Behaviour

Each gym registration route should be installable as a PWA so a tablet can appear to run a dedicated BGM Registration app.

Requirements:

- official BGM app icon/branding;
- standalone display where supported;
- installed launch returns directly to the correct `/join/<gym-slug>` route;
- no one-time physical provisioning requirement;
- replacing a broken tablet requires only opening the correct gym URL and installing/adding it again;
- route/gym identity remains obvious inside the UI.

The public/customer PWA is online-only for submission.

## 5. Shared Registration Form

The tablet and Staff Portal use one shared registration-domain model and, where practical, the same underlying form component.

### 5.1 Tablet context

- gym comes from `/join/<gym-slug>`;
- new memberships only;
- live camera photo mandatory for every applicant;
- no gallery upload;
- customer-facing copy;
- successful submission creates a pending application and clears the tablet.

### 5.2 Staff context

- gym comes from the authenticated shared staff account;
- New Membership and Renewal available;
- photo may be captured, uploaded, retained from an existing member, or deferred;
- staff-facing controls may expose corrective/operational actions not shown publicly;
- staff session remains authoritative for gym scope.

## 6. Membership Types and Durations

Initial membership types:

- Single / Regular
- Student
- Couples

Initial durations:

- 1 week
- 2 weeks
- 1 month
- 3 months
- 6 months
- 1 year

Membership types and durations use centrally configured Super Admin pricing.

The tablet shows the current configured price before the applicant commits to the form.

For Couples, the displayed price is the configured combined Couples price, not two separately calculated Single prices.

## 7. Up-Front Document Readiness Warning

Immediately after selecting the membership type, and before the applicant spends time completing the form, show a prominent **You will need at reception** panel.

### 7.1 Regular / Single

Applicant must be told they will need:

- valid ID card or passport.

### 7.2 Student

Applicant must be told they will need:

- valid ID card or passport;
- valid student card or supporting student document.

### 7.3 Couples

Applicants must be told they will need:

- valid ID cards/passports for both applicants;
- documents/ID evidence showing both applicants reside at the same address.

The applicant must acknowledge this information before continuing.

The relevant requirement is repeated on the final submission-success screen.

## 8. Membership Dates

For public/tablet registration:

- start date defaults to the server-resolved calendar day of submission in `Europe/Malta`;
- the applicant does not choose a different start date;
- expiry is derived from the selected duration using the platform's canonical membership-date rules.

During staff review, reception may change the start date before activation. Expiry is recalculated from the final staff-approved start date and duration.

The final activated dates are server-authoritative.

## 9. Applicant Details

For each applicant, collect at minimum:

- first name;
- last name;
- ID card/passport number;
- date of birth;
- address line(s);
- town/locality;
- postcode;
- phone/mobile;
- email;
- next of kin / emergency contact.

The implementation must preserve compatibility with the existing member/application schema and approved legacy-member transition architecture.

## 10. Couples Membership

A Couples application is one application/transaction containing two complete people.

The tablet collects for both applicants:

- full personal details;
- separate identity information;
- separate live photo;
- separate acceptance record for applicable declarations/rules.

Couples share:

- membership type;
- duration;
- start date;
- expiry date;
- one combined configured price;
- one payment transaction;
- one discount code if applicable.

Activation creates:

- two distinct member records where they do not already exist;
- two permanent membership numbers;
- two separate physical/member cards;
- two official photos;
- a relationship back to the same Couples application/membership transaction.

Couples activation is atomic: both members/cards succeed together or the application remains pending.

Before Payment Received / activation, staff must confirm same-address evidence was verified.

No copies of residence evidence are stored.

## 11. Student Membership

Student applicants complete the standard registration information and live photo.

The platform does not store a copy of the student card/supporting document.

At submission completion, show wording in this meaning:

**Application submitted — please show your valid student ID or supporting document to our reception staff to complete your membership.**

Before activation, staff must confirm student eligibility/documentation was verified.

The verification event is auditable with staff/system/gym/timestamp context.

## 12. Under-18 Members and Guardian Co-Signature

Age is derived from date of birth.

If the applicant is under 18 on the server-recorded application submission date, the application permanently requires the Parent / Legal Guardian path for that application even if staff later changes the membership start date.

Capture at minimum:

- guardian full name;
- guardian ID/passport number;
- relationship to the member;
- mobile number;
- email;
- address.

The final tablet screen tells the applicant that the parent/legal guardian must be present to co-sign at reception.

Before Payment Received / activation, staff must confirm:

- guardian is present;
- the printed form has been co-signed by the guardian.

The printed member sheet includes dedicated guardian signature/date fields.

## 13. Tablet Photo Rules

For the public/tablet flow, a live photo is mandatory for every applicant.

Requirements:

- camera-first capture;
- no gallery/file upload option;
- preview after capture;
- **Use Photo** or **Retake**;
- submission remains blocked until each required applicant has an accepted live photo.

For Couples, both applicants require separate live photos.

The photo travels with the pending application and becomes the official member photo after successful activation.

## 14. Staff Portal Photo Rules

Staff-created New Membership and Renewal flows must be more resilient.

Staff gets these photo choices:

- **Take Photo** using webcam/camera;
- **Upload Image** from the staff device;
- **Photo Later**.

For renewals, an existing official photo is retained unless staff replaces it.

A membership may be activated without a photo when created/renewed through the Staff Portal.

If no official photo exists after activation, the member is marked:

**PHOTO REQUIRED**

### 14.1 PHOTO REQUIRED at reception/check-in

PHOTO REQUIRED must not block entry by itself.

When a member with PHOTO REQUIRED scans their card/barcode:

- the normal membership-status rules still determine whether entry is allowed;
- reception sees a prominent PHOTO REQUIRED warning;
- staff can admit the member if the membership is otherwise valid;
- the warning appears again on future scans until an official photo is captured;
- staff can launch webcam capture or image upload from the warning/member detail.

After a photo is confirmed:

- upload/store it in private Supabase Storage using the established official-photo architecture;
- update the central member record;
- clear PHOTO REQUIRED;
- audit the change;
- make the updated official photo available across Staff, Admin and member-facing surfaces that use it.

## 15. Gym Rules Source and Initial Version

The initial authoritative Gym Rules/declaration wording comes from the user-provided PDF:

`Generic Membership form.pdf`

The implementation must seed the **exact source-backed Gym Rules and existing declaration wording** from that document as the initial published version rather than inventing replacement wording.

The PDF contains the BGM Membership Form, eleven Gym Rules and existing declaration/signature wording.

The PDF does not automatically supply any legal wording that is not actually present in it. If the required privacy/data-processing or health declaration wording is not present in the source PDF, the system must require a published Super Admin version before public enrollment can go live; implementation must not invent legal copy.

The managed digital system becomes the operational source after seeding, but historical versioning preserves the exact wording each applicant accepted.

## 16. Versioned Gym Rules and Declarations

The enrollment flow includes mandatory acknowledgement of:

- Gym Rules;
- privacy/data-processing consent;
- health declaration.

The actual wording is Super Admin-managed.

Every published edit creates a new version. Existing historical versions are not overwritten.

Each submitted application stores the exact published version identifiers and immutable content snapshot/hash necessary to reproduce what was accepted.

Historical applications/printouts continue to render the wording accepted by that member even if Super Admin publishes newer wording later.

Under-18/guardian-specific wording is included where applicable.

Public enrollment cannot be enabled for a gym unless all required declaration categories have a currently published version.

## 17. Duplicate Identity Detection and Returning Members

ID/passport matching is server-side and normalized.

The duplicate check should occur as soon as the public form has enough identity information to perform it, so an already-active member is redirected to reception before unnecessarily completing the entire application.

### 17.1 No existing member match

Proceed as a normal New Member application.

### 17.2 Existing ACTIVE member match

The public/tablet submission is blocked.

Show a clear message that the ID is already linked to an active BGM membership and the person should speak to reception.

Do not create a duplicate application/member.

### 17.3 Existing EXPIRED/INACTIVE member match

Do not destroy the applicant’s work and do not force them to restart.

Accept the submission as a pending application and clearly flag it to reception:

**EXISTING MEMBER FOUND — POSSIBLE RENEWAL**

Staff can choose:

- **Renew Existing Member**
- **Reject Application**

Renew Existing Member links the application to the existing member record and converts the process into the approved renewal workflow.

Rules:

- preserve the permanent BGM membership number;
- preserve membership history;
- reuse/update the existing member rather than creating a duplicate person;
- staff reconfirms current details;
- fresh tablet details/photo may update the current member profile after review;
- card handling follows Keep Existing Card / Issue Replacement Card rules.

Reject Application closes the submission with an auditable reason and makes no changes to the existing member.

### 17.4 Duplicate mobile/email

Exact mobile/email matches do not block submission because legitimate household/shared contact details are possible.

They produce a reception warning for staff review.

## 18. Staff New Membership and Renewal Entry Points

The Staff Portal New Member area offers exactly:

- **NEW MEMBERSHIP**
- **RENEWAL**

### 18.1 New Membership

Uses the shared registration form with staff context.

### 18.2 Renewal

Search/select an existing member and reuse the approved renewal flow.

Renewal preserves:

- member record;
- permanent membership number;
- membership history.

Staff reconfirms details before activation.

## 19. Card Handling

### 19.1 New member

Staff assigns/scans an unused physical card using the existing reservation/conflict-prevention architecture.

Permanent membership number allocation remains server-side and only occurs at the approved activation/commit point.

### 19.2 Renewal

Staff chooses:

- **Keep Existing Card**; or
- **Issue Replacement Card**.

Replacement card rules:

- scan/enter an unused card;
- stage it during review;
- do not make it current yet;
- finalize only after successful Payment Received / activation;
- retire the previous card from current use only after replacement finalization succeeds.

### 19.3 Couples

Couples require two separately validated/finalized cards, one per member.

## 20. Membership Pricing

Super Admin manages prices by membership type and duration.

At minimum the settings model supports:

- Single × each duration;
- Student × each duration;
- Couples × each duration.

Staff and public/tablet clients are read-only consumers of the published price catalog.

They cannot manually alter the configured base price.

### 20.1 Price snapshot

At application submission, capture the exact configured base price and published pricing-version identifier shown to the applicant.

Later Super Admin price changes must not change an already-submitted application.

Staff review displays the application’s captured price snapshot.

New applications use the newly published price immediately.

## 21. Discount Codes

Only Super Admin can create/edit/enable/disable discount codes.

A discount code contains:

- code;
- percentage discount;
- active/inactive state;
- indefinite validity by default;
- optional valid-from date;
- optional expiry date;
- unlimited uses by default;
- optional maximum successful-use count.

Only one discount code may apply to one membership application. No stacking.

For Couples, the one code applies to the combined Couples total.

Staff cannot change the configured percentage or manually type an arbitrary discount amount.

### 21.1 Validation

Discount validation is server-side.

Validity windows are evaluated from server time in `Europe/Malta` calendar-date terms.

At payment time, validate:

- code exists;
- active state;
- validity window;
- usage-limit availability;
- application has no other applied code.

Limited-use allocation must be transaction-safe so two gyms cannot consume the same final redemption concurrently.

### 21.2 Usage counting

A limited-use code is consumed only when Payment Received / activation succeeds.

Merely typing/previewing a code does not consume a use.

### 21.3 Staff display

Show:

- base price;
- discount code;
- discount percentage;
- discount amount;
- final amount due.

### 21.4 Print/audit

The printed form and audit trail include:

- discount code;
- percentage;
- discount amount;
- final total.

## 22. Payment

Payment remains operationally simple in this phase.

Payment methods:

- Cash
- Card
- Other — please specify

If Other is selected, descriptive text is mandatory.

No payment-terminal/payment-gateway integration is required.

Payment confirmation still requires individual Staff Name as already designed in the Staff Dashboard workflow.

Payment Received remains the activation action.

## 23. Verification Gates Before Activation

Before Payment Received / activation, staff must satisfy the applicable verification gates.

### 23.1 Regular / Single

- ID/passport verified.

### 23.2 Student

- ID/passport verified;
- student card/supporting-document eligibility verified.

### 23.3 Couples

- both identities verified;
- same-address evidence verified.

### 23.4 Under 18

- guardian present;
- printed application co-signed by guardian.

No copies of student/residence proof are stored.

Verification records are auditable with staff/gym/system/timestamp context.

## 24. Payment Received / Activation

Payment Received performs final server-side revalidation before activation.

At minimum revalidate:

- application state;
- membership type/duration;
- final start/expiry dates;
- required applicant data;
- card state;
- required document-verification gates;
- guardian gate where applicable;
- price snapshot/version;
- discount code validity/use limit;
- payment method;
- Staff Name;
- identity/renewal linkage.

On success:

- create/update final member record(s);
- allocate/finalize permanent membership number(s) centrally;
- finalize physical card(s);
- consume discount use if applicable;
- record payment/activation timestamps;
- store final payment amount/method;
- remove application from active Waiting queue;
- show membership-active success state.

The operation must be idempotent and safe against duplicate submission/retry.

## 25. Printed Membership Form — One A4 Sheet per Member

This is a hard requirement.

### 25.1 Page count

- Single / Regular: exactly 1 A4 sheet.
- Student: exactly 1 A4 sheet.
- Couples: exactly 2 A4 sheets total — one independent A4 sheet per member.

Each member sheet must fit on one printed A4 page.

### 25.2 Contents per member sheet

Each sheet contains, as applicable:

- BGM branding;
- application reference;
- submitted date/time;
- member photo when available;
- member name;
- personal/contact details;
- ID/passport details;
- member/permanent membership number if allocated;
- physical/card identifier if allocated;
- membership type;
- duration;
- start date;
- expiry date;
- enrollment gym;
- base price;
- discount code;
- discount percentage;
- discount amount;
- final total;
- payment method;
- payment/activation timestamp if completed;
- payment Staff Name if completed;
- document-verification confirmations;
- exact applicable Gym Rules/declaration version/content;
- Member Signature + Date;
- Staff Signature + Date;
- Guardian Signature + Date where required.

For Couples, shared transaction/payment information appears on both member sheets so each page can stand alone as a record.

### 25.3 Print layout

Use print-specific A4 CSS with controlled margins and explicit page breaks between members.

Operational dashboard/navigation controls must never appear on paper.

### 25.4 Super Admin print-overflow protection

When Super Admin edits Gym Rules/declaration wording, the Membership Settings UI must provide an A4 preview/overflow check before publishing.

If the candidate version would push the member form beyond one A4 page, warn the Super Admin before publication.

The preview must use the same effective print typography/layout constraints as the actual member print route closely enough for the warning to be meaningful.

## 26. Super Admin Membership Settings

This slice adds only the minimum Super Admin controls needed by enrollment. It is not the full Admin Portal redesign.

Add a focused Membership Settings area for Super Admin only.

### 26.1 Membership prices

Manage:

- membership type;
- duration;
- price;
- published/current pricing version.

### 26.2 Discount codes

Manage:

- code;
- percentage;
- active/inactive;
- optional valid-from;
- optional expiry;
- optional maximum successful uses;
- usage count/history.

### 26.3 Rules/declarations

Manage:

- Gym Rules;
- privacy/data-processing wording;
- health declaration;
- version history;
- publish new version;
- one-A4-page preview/overflow check.

Staff and public/tablet clients cannot edit these settings.

All Super Admin changes are audited.

## 27. Submission Completion and Tablet Reset

After the server confirms a successful public/tablet submission:

1. show the appropriate success message;
2. direct the applicant to reception;
3. repeat the applicable Regular/Student/Couples/Minor document reminder;
4. clear all personal fields;
5. clear temporary photo data;
6. reset the form to a fresh application for the next person.

Never clear the form merely because the user pressed Submit. Clear only after confirmed server persistence.

## 28. Connectivity and Public Tablet Failure Handling

Public/tablet enrollment is online-only.

If connectivity is lost:

- show a prominent connection/error state;
- preserve the in-progress form while the page remains open;
- do not claim the application was submitted;
- allow retry when connectivity returns;
- never assign a permanent membership number locally.

If camera permission is denied/unavailable:

- explain that a live photo is required for tablet enrollment;
- provide a clear retry-camera action;
- do not expose a gallery-upload fallback on the public tablet.

## 29. Staff Offline Business Continuity

The Staff Portal provides the operational fallback when a gym loses internet.

The public customer tablet is not the offline fallback.

### 29.1 Eligibility for offline mode

Offline enrollment is available only on a staff device/browser that has previously authenticated and synchronized successfully.

An unknown/uninitialized device cannot create offline membership data.

### 29.2 Offline state

Show a highly visible banner such as:

**OFFLINE MODE — Applications will sync automatically when connection returns**

Also show a persistent count such as:

**3 APPLICATIONS WAITING TO SYNC**

### 29.3 Local queue

Use browser-local durable storage suitable for structured data and photo blobs (for example IndexedDB) to queue offline staff applications.

Each offline application receives a temporary globally unique client/application identifier such as a UUID.

Do not allocate a permanent BGM membership number locally.

### 29.4 Offline new membership

Staff can still:

- choose membership type/duration from the last successfully synchronized published catalog;
- enter member details;
- capture/upload a photo or choose Photo Later;
- record payment method/Staff Name;
- scan/enter the intended physical card as pending confirmation;
- queue the application for sync.

Because the gym is offline, no central duplicate-ID lookup is trusted at creation time. During synchronization the server performs the normal identity check before creating any member:

- no match -> continue as new member;
- active existing match -> place the queued item into staff conflict/review, do not create a duplicate;
- expired/inactive existing match -> convert/offer the same possible-renewal review path, do not create a duplicate.

The UI must clearly distinguish local/pending state from centrally activated state.

### 29.5 Offline renewal

Offline renewal does not require a locally cached copy of the whole member database.

Staff must identify the returning member using a known permanent BGM membership number/current card barcode, normally by scanning the existing card or entering the known permanent number.

The queued renewal stores that identifier plus staff-reconfirmed details.

On synchronization, the server resolves the permanent identifier to the central member record and validates it before applying any change.

If the identifier does not resolve uniquely or safely, the queued renewal becomes a recoverable staff conflict and no new member is created.

### 29.6 Permanent membership numbers

Only the central server/Supabase transaction allocates permanent BGM membership numbers.

This rule is absolute and prevents two offline gyms from generating the same number.

When queued applications synchronize, the server allocates/finalizes numbers in central transactional order.

### 29.7 Cards while offline

A scanned replacement/new physical card may be recorded locally as:

**CARD PENDING CONFIRMATION**

It is not finalized while offline.

On synchronization, the server revalidates the card against current central assignments/reservations.

If a conflict exists, synchronization stops that application at a recoverable staff-review state rather than overwriting another member/card.

### 29.8 Payment while offline

Staff may record that payment was received locally, but the UI must state:

**PAYMENT RECORDED — PENDING ONLINE ACTIVATION**

The membership is not considered centrally activated until the queued data synchronizes and server validation succeeds.

The offline flow must show/print a simple pending reference containing at least the temporary application reference, member name, gym, recorded payment method/amount and the words **PENDING ONLINE ACTIVATION** so staff has an operational record during the outage.

Reception may manually admit the person during the outage based on local operational judgment.

### 29.9 Discount codes while offline

For the initial offline implementation, do not finalize discount codes without connectivity.

This avoids stale validity windows and usage-limit races across gyms.

If a discounted membership is required during an outage, the discount-dependent payment/activation remains pending until connectivity returns and the code can be validated centrally.

### 29.10 Sync recovery

When connectivity returns:

1. upload the queued application/photo data;
2. server performs duplicate identity checks and current-state validation;
3. server revalidates current membership/card/discount/settings state;
4. central transaction allocates/finalizes permanent identities/cards as applicable;
5. server returns confirmed central records;
6. mark the local item synchronized;
7. delete local sensitive copies only after confirmed successful persistence;
8. keep failed/conflicted items in a visible recoverable queue with actionable errors.

Synchronization must be idempotent so retrying the same local application cannot create duplicate members/memberships.

## 30. Pricing and Content Caching for Offline Staff

The staff device may cache the most recently synchronized **published** membership price catalog and declaration/rules metadata for operational continuity.

Every cached pricing item includes the published pricing-version identifier used when it was fetched.

Offline staff enrollment uses that last published price as the provisional quoted price.

When synchronization occurs, the server verifies the submitted offline price against the historical server-side pricing version referenced by the queued application:

- if the version exists and the quoted price matches that historical published version, preserve that quoted price even if a newer price was published while the gym was offline;
- if the version is unknown, altered or the amount does not match the historical server record, do not silently change the amount; place the application into a recoverable pricing-conflict review state.

This makes the offline price deterministic, prevents client-side price tampering, and preserves what staff legitimately saw/quoted during the outage.

## 31. Photo Handling During Offline Staff Enrollment

If staff captures/uploads a photo while offline:

- queue the image blob with the local application;
- upload it when sync succeeds;
- finalize it into the central official-photo flow after activation.

If staff chooses Photo Later:

- allow central activation after successful sync;
- mark the member PHOTO REQUIRED;
- use the repeated reception/check-in warning flow until resolved.

## 32. Server Authority and Security

The browser must never be trusted for authoritative values that can be derived/validated centrally.

Server-authoritative or server-validated values include:

- enrollment gym slug resolution;
- application timestamps;
- membership price/version;
- membership duration/date rules;
- ID/passport duplicate status;
- declaration/rules versions;
- discount validity/usage;
- card conflicts/reservations;
- permanent membership numbers;
- payment/activation timestamps;
- final activation state.

Privileged Supabase/service credentials remain server-only.

Public routes cannot read arbitrary member/application information.

Duplicate-ID checks reveal only the minimum outcome needed by the public flow, not private member details.

Normal gym staff authorization remains scoped server-side to the authenticated gym except for explicitly approved network-wide Super Admin behaviour.

## 33. Data Integrity and Transactionality

Important multi-record operations must be atomic where practical.

Especially:

- Couples activation;
- two-card Couples finalization;
- permanent number allocation;
- replacement-card finalization;
- limited-use discount consumption;
- payment/activation completion;
- offline-sync idempotency.

Retries must not create duplicate members, duplicate memberships, duplicate card assignments or duplicate discount redemptions.

## 34. Audit Requirements

Audit at minimum:

- public/tablet application submitted;
- gym route/context used;
- duplicate-ID classification;
- possible-renewal match;
- application converted to renewal;
- application rejected and reason;
- staff corrections;
- document-verification confirmations;
- guardian verification/co-sign confirmation;
- card reservation/assignment/replacement;
- price snapshot/version;
- discount code preview/application/consumption;
- payment method and Staff Name;
- payment received;
- activation;
- photo captured/uploaded/replaced;
- PHOTO REQUIRED cleared;
- print/reprint;
- Super Admin price change;
- Super Admin discount change;
- rules/declaration version publication;
- offline application queued;
- offline sync succeeded/failed/conflicted.

Audit timestamps are server-authoritative whenever the event reaches the server. Offline local events retain their local occurrence context plus final server synchronization timestamp.

## 35. Testing Requirements

Implementation uses TDD for new behaviour.

At minimum verify:

### 35.1 Public gym route/PWA

- valid gym slug loads correct gym identity;
- invalid/inactive gym slug cannot submit;
- installed PWA start route points to correct gym route;
- public flow exposes New Member only;
- public flow never exposes staff Renewal controls.

### 35.2 Membership selection/readiness

- Single/Student/Couples show correct document reminders before form completion;
- applicant must acknowledge readiness notice before continuing;
- configured current price is displayed;
- start date defaults to the Malta submission date.

### 35.3 Photos

- public submission blocked without required live photo(s);
- no public gallery upload path;
- Couples require two photos;
- staff flow allows webcam/upload/photo-later;
- PHOTO REQUIRED warning repeats on subsequent scans;
- PHOTO REQUIRED does not block an otherwise valid check-in;
- confirmed later photo updates central official-photo record and clears warning.

### 35.4 Duplicate identity

- no match -> new application;
- active ID/passport match -> public submission blocked and directed to reception;
- expired/inactive match -> submission accepted and flagged possible renewal;
- staff converts flagged application to renewal without creating duplicate member;
- staff can reject flagged application without changing existing member;
- duplicate phone/email -> warning only.

### 35.5 Couples

- two full member profiles;
- one shared membership transaction;
- two permanent members/numbers/cards;
- atomic activation;
- same-address verification required;
- exactly two A4 pages, one per member.

### 35.6 Student

- student-document reminder displayed;
- student verification required before activation;
- no proof-document storage.

### 35.7 Under 18

- guardian details automatically required when under 18 on submission date;
- later start-date change does not remove that application's guardian requirement;
- guardian presence/co-sign confirmation required before activation;
- guardian signature fields appear on one-page member printout.

### 35.8 Rules/declarations

- seed exact source-backed rules/existing declaration from `Generic Membership form.pdf`;
- public enrollment blocked until every required declaration category has a published version;
- mandatory acknowledgements;
- application stores exact accepted versions;
- historical application renders old wording after new version published;
- Super Admin publication creates a new version rather than overwriting history.

### 35.9 Pricing

- only Super Admin can change prices;
- submitted application keeps captured price after later price change;
- staff/public cannot manually alter base price;
- offline historical price version is preserved when it matches server history;
- tampered/unknown offline price version creates recoverable conflict rather than silent repricing.

### 35.10 Discounts

- valid code applies correct percentage;
- one code only;
- expired/not-yet-valid/disabled code rejected;
- usage-limited code rejected after maximum successful uses;
- usage counted only on successful activation;
- concurrent final-use race is safe;
- print includes code/percentage/amount/final total;
- discount is not finalized offline.

### 35.11 Payment

- Cash/Card/Other supported;
- Other requires description;
- Staff Name required;
- Payment Received performs server revalidation.

### 35.12 Printing

- Single/Student exactly one A4 page;
- Couples exactly one A4 page per member;
- rules/declarations/signatures fit;
- operational UI omitted;
- Super Admin overflow warning detects candidate content that would exceed one member A4 sheet.

### 35.13 Offline staff continuity

- previously initialized staff device can enter offline mode;
- unknown/uninitialized device cannot create offline membership data;
- offline application receives temporary UUID, not permanent member number;
- no permanent BGM number generated client-side;
- offline new-member duplicate ID is rechecked centrally before member creation;
- offline renewal can be queued from a known permanent number/card without caching the whole member database;
- unresolved renewal identifier creates recoverable conflict, not a new member;
- card remains pending until central validation;
- payment shows pending-online-activation state;
- pending receipt/reference clearly states PENDING ONLINE ACTIVATION;
- queued application survives page/app restart as designed;
- sync is idempotent;
- two gyms offline cannot create duplicate permanent membership numbers;
- card conflict during sync becomes recoverable conflict, not overwrite;
- successful sync removes local sensitive copy only after central confirmation;
- failed sync keeps local item visible/actionable.

### 35.14 Regression

- existing member app remains green;
- existing Staff Dashboard workflow remains green;
- existing renewal/card rules remain green;
- existing barcode reception/check-in rules remain green;
- TypeScript passes;
- Next.js production build passes;
- browser verification covers tablet and Staff Portal flows.

## 36. Implementation Boundaries

### In scope

- gym-specific `/join/<slug>` new-member routes;
- installable registration PWA behaviour;
- shared registration form/domain model;
- live-photo-only tablet capture;
- staff webcam/upload/photo-later options;
- PHOTO REQUIRED follow-up workflow;
- Single/Student/Couples applications;
- two-person Couples application/activation;
- under-18 guardian details/co-sign gate;
- up-front document readiness notices;
- active vs expired/inactive duplicate-ID handling;
- tablet possible-renewal flag and staff conversion;
- central membership pricing;
- discount codes and limits/validity;
- versioned Gym Rules/declarations;
- initial source-backed rule/declaration seed from `Generic Membership form.pdf`;
- one-A4-page-per-member printing;
- A4 overflow warning in Super Admin settings;
- simple Cash/Card/Other payment method capture;
- staff offline enrollment queue and central synchronization;
- audit coverage for new behaviours.

### Out of scope

- full Admin Portal redesign;
- NFC;
- payment-terminal/payment-gateway integration;
- storing copies of student IDs/cards or residence-proof documents;
- public/customer offline enrollment;
- local/offline permanent membership-number allocation;
- local/offline final card allocation;
- individual staff user accounts;
- arbitrary staff-entered discounts;
- multiple/stacked discount codes;
- changes to unrelated member-app features.

## 37. Acceptance Criteria

This slice is complete when all of the following are true:

1. Every active gym can expose a stable `/join/<gym-slug>` registration route tied to that gym.
2. The route is installable as a BGM registration PWA and reopens to the correct gym.
3. Tablet registration is New Member only.
4. Staff Portal offers New Membership and Renewal.
5. Staff New Membership reuses the shared registration flow.
6. Applicant chooses Single/Student/Couples and duration and sees the published price.
7. Applicant is warned up front about the documents needed at reception before completing the form.
8. Tablet start date defaults to the Malta submission day; staff may change it before activation.
9. Public tablet requires live photo for every applicant and has no gallery upload.
10. Couples collects two full profiles and two live photos in one application.
11. Couples creates two member identities/cards but one shared membership transaction/payment.
12. Under-18 applicants require guardian details and guardian co-sign verification before activation.
13. Gym Rules/existing declaration use the exact source-backed wording from `Generic Membership form.pdf`; any missing legal declaration category must be explicitly published by Super Admin rather than invented.
14. Every application preserves the exact rules/declaration versions accepted at submission.
15. Active existing ID/passport blocks public new-member submission and directs to reception.
16. Expired/inactive existing ID/passport accepts the application and flags it as a possible renewal.
17. Staff can convert that application to a renewal while preserving the permanent member record/number/history, or reject it.
18. Duplicate mobile/email creates warning only.
19. Staff can keep the existing card or stage a replacement card on renewal.
20. Super Admin controls prices; submitted applications retain their captured price snapshot.
21. Super Admin controls percentage discount codes with indefinite/unlimited defaults plus optional date windows/use limits.
22. Only one discount code applies per application and limited uses are consumed only on successful activation.
23. Staff sees base price, discount and final amount due.
24. Payment method is Cash/Card/Other, with mandatory description for Other.
25. Student, Couples, Regular identity and guardian verification gates are enforced before activation as applicable.
26. No student/residence proof documents are stored.
27. Payment Received performs central revalidation and transactional activation.
28. Single/Student prints exactly one A4 sheet per member.
29. Couples prints exactly two A4 sheets total, one per member.
30. Super Admin receives a print-overflow warning before publishing rules/declarations that would exceed one A4 page per member.
31. Staff-created New Membership/Renewal may activate without a photo and set PHOTO REQUIRED.
32. PHOTO REQUIRED warns on every future scan until resolved but does not block an otherwise valid check-in.
33. Later webcam/upload photo updates the central official-photo record and clears PHOTO REQUIRED.
34. During internet outage, an initialized Staff Portal can queue new memberships and known-member renewals locally using temporary UUIDs/references.
35. No offline gym can allocate permanent BGM membership numbers or final cards locally.
36. Offline new-member identity is revalidated centrally before creation, preventing duplicate members when another gym/system already holds that ID.
37. When connectivity returns, queued items sync idempotently and central transactions allocate/finalize membership identities/cards.
38. Offline payment remains visibly pending online activation until central sync succeeds.
39. Offline quoted pricing is accepted only when it matches the referenced historical published pricing version; otherwise it becomes a recoverable conflict.
40. Discount codes are not finalized offline in the initial implementation.
41. Existing member, staff, renewal, barcode and card behaviour remains working.
42. Development does not create unnecessary Vercel deployments; one deliberate Preview is used only at the approved checkpoint before Production.