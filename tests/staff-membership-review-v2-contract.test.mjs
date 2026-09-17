import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

const modal = read("components/staff/StaffMembershipReviewModal.tsx");
const pendingActions = read("components/staff/PendingMembershipActions.tsx");
const applicationRoute = read("app/api/system/members/applications/[applicationId]/route.ts");
const cardRoute = read("app/api/system/members/card/assign/route.ts");
const migration = read("supabase/migrations/20260917_150000_staff_membership_review_v2.sql");

test("staff review shows possible-renewal and type-specific verification controls", () => {
  assert.match(modal, /EXISTING MEMBER FOUND — POSSIBLE RENEWAL/);
  assert.match(modal, /Renew Existing Member/);
  assert.match(modal, /Reject Application/);
  assert.match(modal, /ID \/ passport verified/);
  assert.match(modal, /Student eligibility verified/);
  assert.match(modal, /Same-address evidence verified/);
  assert.match(modal, /Guardian present verified/);
  assert.match(modal, /Guardian co-sign verified/);
});

test("review UI persists verification through the save_review action", () => {
  assert.match(modal, /action:\s*["']save_review["']/);
  assert.match(modal, /idVerified/);
  assert.match(modal, /studentEligibilityVerified/);
  assert.match(modal, /guardianPresentVerified/);
  assert.match(modal, /guardianCosignVerified/);
  assert.match(modal, /sameAddressVerified/);
  assert.match(applicationRoute, /action\s*===\s*["']save_review["']/);
  assert.match(applicationRoute, /bgm_apply_membership_application_review/);
  assert.match(applicationRoute, /systemUserId:\s*auth\.context\.systemUserId/);
});

test("reuse_existing_member accepts only the application participant id and delegates to a locked server RPC", () => {
  assert.match(applicationRoute, /action\s*===\s*["']reuse_existing_member["']/);
  assert.match(applicationRoute, /applicationMemberId/);
  assert.match(applicationRoute, /bgm_confirm_membership_existing_member/);
  assert.doesNotMatch(applicationRoute, /body\.(?:memberId|matchedMemberId|existingMemberId)/);

  assert.match(migration, /create or replace function public\.bgm_confirm_membership_existing_member/i);
  assert.match(migration, /matched_member_id/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /membership_expiry/i);
  assert.match(migration, /existing_member_id\s*=\s*v_participant\.matched_member_id/i);
  assert.match(migration, /membership\.application\.reuse_existing_member/i);
});

test("new applications keep a match separate from explicit existing-member reuse", () => {
  assert.match(migration, /bgm_enforce_membership_application_identity_match/i);
  assert.match(migration, /application_kind/i);
  assert.match(migration, /existing_member_id\s*:=\s*null/i);
  assert.match(migration, /identity_match_state\s*=\s*'expired_inactive'/i);
  assert.match(migration, /existing_member_id\s*=\s*null/i);
});

test("reject_application requires a reason, cancels the application, releases reserved cards and audits", () => {
  assert.match(modal, /rejectReason/);
  assert.match(modal, /action:\s*["']reject_application["']/);
  assert.match(applicationRoute, /action\s*===\s*["']reject_application["']/);
  assert.match(applicationRoute, /reason/);
  assert.match(applicationRoute, /bgm_reject_membership_application/);

  assert.match(migration, /create or replace function public\.bgm_reject_membership_application/i);
  assert.match(migration, /status\s*=\s*'cancelled'/i);
  assert.match(migration, /cancelled_at\s*=\s*now\(\)/i);
  assert.match(migration, /delete from public\.bgm_member_card_credentials/i);
  assert.match(migration, /status\s*=\s*'reserved'/i);
  assert.match(migration, /membership\.application\.reject/i);
});

test("possible renewals expose stored match, warnings, historical price/declaration context and verification state", () => {
  assert.match(applicationRoute, /matched_member_id/);
  assert.match(applicationRoute, /identity_match_state/);
  assert.match(applicationRoute, /duplicate_contact_warning/);
  assert.match(applicationRoute, /under_18_at_submission/);
  assert.match(applicationRoute, /id_verified_at/);
  assert.match(applicationRoute, /student_eligibility_verified_at/);
  assert.match(applicationRoute, /guardian_present_verified_at/);
  assert.match(applicationRoute, /guardian_cosign_verified_at/);
  assert.match(applicationRoute, /same_address_verified_at/);
  assert.match(applicationRoute, /base_price_cents/);
  assert.match(applicationRoute, /declaration_snapshot/);

  assert.match(modal, /duplicateContactWarning/);
  assert.match(modal, /basePriceCents/);
  assert.match(modal, /declarationSnapshot/);
});

test("card handling follows each participant's confirmed existing-member state for mixed Couples", () => {
  assert.match(cardRoute, /reusesExistingMember\s*=\s*Boolean\(participant\.existing_member_id\)/);
  assert.doesNotMatch(cardRoute, /if\s*\(\s*application\.application_kind\s*===\s*["']new["']\s*\)/);
  assert.match(pendingActions, /existingMemberId/);
  assert.match(pendingActions, /participant\.existingMemberId/);
});

test("new privileged review functions remain service-role only", () => {
  assert.match(migration, /revoke all on function public\.bgm_confirm_membership_existing_member[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.bgm_confirm_membership_existing_member[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function public\.bgm_reject_membership_application[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.bgm_reject_membership_application[\s\S]*to service_role/i);
});
