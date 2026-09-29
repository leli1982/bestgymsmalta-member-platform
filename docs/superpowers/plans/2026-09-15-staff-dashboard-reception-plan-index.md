# Staff Dashboard & Reception — Plan Index

Date: 2026-09-15
Status: Ready for implementation

The approved Staff Dashboard implementation is defined by these documents, read together in this order:

1. `docs/superpowers/specs/2026-09-15-staff-dashboard-reception-design.md` — approved architecture and workflow.
2. `docs/superpowers/specs/2026-09-15-staff-dashboard-reception-manual-card-entry-addendum.md` — approved scanner-malfunction fallback.
3. `docs/superpowers/plans/2026-09-15-staff-dashboard-reception.md` — main TDD implementation plan.
4. `docs/superpowers/plans/2026-09-15-staff-dashboard-reception-manual-card-entry-addendum.md` — Task 6 manual-card fallback amendment.
5. `docs/superpowers/plans/2026-09-15-staff-dashboard-reception-self-review-amendments.md` — atomic correction-save hardening discovered during final plan review.

If any wording conflicts, the later addendum/amendment wins for its specific topic.

Key locked decisions:

- one shared gym login/password per location;
- gym is server-bound from the authenticated system account;
- icon-first always-open Staff Dashboard;
- member browse/search by name, member number, ID number, phone/mobile and email;
- All / Active / Expired filters;
- gym-specific new-member waiting queue;
- automatic server submission/payment/activation timestamps shown in `Europe/Malta`;
- short new-application arrival sound plus prominent popup/badge;
- staff can correct pending form details with full before/after audit trail;
- card scan supports hardware scanner plus secondary **Enter card number manually** fallback;
- scanner and manual entry use the same existing card-assignment endpoint and validation;
- Payment Received asks for staff name and immediately activates when prerequisites pass;
- A4 print form contains final corrected information plus member/staff signature areas;
- pending corrections are persisted atomically through a service-role-only Postgres RPC;
- Realtime carries refresh-only signals with no member/application PII;
- no NFC work in this slice.