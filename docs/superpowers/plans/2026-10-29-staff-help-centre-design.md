# Staff Help Centre Design

## Intent
Add professional, searchable in-app help for regular Staff so they can solve common questions without leaving the current task.

## Goals
- Floating `? Help` button available on every `/staff` page.
- Help opens as an overlay without navigating away from the current task.
- Local instant keyword search across help topics.
- Current staff page automatically promotes the most relevant topic.
- Help wording mirrors the approved Staff Manual v1.1.
- Include quick topics for Scan Member, Find Member, New Member, Applications, Renew, Reception/Card, Sundries, Bar and End of Day.
- End of Day help clearly warns that submission locks that day's Bar sheet.
- Bar help reflects the current auto-save workflow and explicitly says there is no Send Bar List button.
- Provide an `Open Full Staff Manual` action that opens a full in-app manual view.
- No AI/API dependency, no database migration and no Production data changes.

## Non-goals
- Super Admin help.
- Manager help.
- Punch Clock instructions before the HU20 fingerprint workflow is released.
- Editing help content from the UI in this first version.

## Approach
Use a shared `StaffHelpCentre` client component mounted in `app/staff/layout.tsx`. Store help topics as typed static data in a separate module so search, context matching and future manual updates are straightforward. Add a `/staff/help` full-manual page that renders the same source content, keeping the popup and full manual consistent.

## Search behaviour
Case-insensitive local search across title, summary, steps and hidden keywords/synonyms. Results update as the user types. With no search text, the current route's matching topic appears first, followed by all topics.

## UI
A fixed orange `? Help` button sits at the bottom-right above the global footer/scanner controls. The modal has a search field, contextual suggestion, topic list and article detail pane. It must work on desktop/tablet/mobile and be keyboard accessible.

## Approaches considered
1. **Searchable in-app Help Centre (chosen):** fastest, offline-friendly, context aware, no AI cost.
2. PDF-only popup: easy but weak search/navigation and not context aware.
3. AI help assistant: flexible but adds cost, latency and risk of answers drifting from approved procedures.
