import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const renewal = read("components/staff/StaffRenewalEnrollmentPage.tsx");
const price = read("app/api/system/members/available-prices/route.ts");
const submit = read("app/api/system/members/enroll/route.ts");
const print = read("app/api/system/members/applications/[applicationId]/print/route.ts");
const review = read("components/staff/StaffMembershipReviewModal.tsx");
const policy = read("lib/guardianConsentSafety.ts");

test("minor staff renewal displays currently published guardian wording and under-16 extra clause", () => {
  assert.match(price, /guardianDeclaration: guardianResult\.data/);
  assert.match(renewal, /guardianDeclaration\.body/);
  assert.match(renewal, /UNDER16_SUPERVISION_CLAUSE/);
  assert.match(renewal, /under16 \? <p/);
  assert.match(renewal, /guardianDeclarationPresented/);
  assert.match(renewal, /Guardian full name/);
  assert.match(renewal, /guardianDeclarationVersionId: guardianDeclaration\?\.id/);
});

test("server uses permanent existing-member DOB and stores new immutable guardian snapshot", () => {
  assert.match(submit, /corresponding\.date_of_birth !== member\.date_of_birth/);
  assert.match(submit, /isUnder18On\(member\.date_of_birth, submittedOnMalta\)/);
  assert.match(submit, /clean\(body\.guardianDeclarationVersionId\) !== published\.id/);
  assert.match(submit, /guardianDeclarationPresented !== true/);
  assert.match(submit, /under_18_at_submission: under18Orders\.includes\(index \+ 1\)/);
  assert.match(submit, /guardian_name: optional\(guardian\.fullName\)/);
  assert.match(submit, /supervisionUnder16Orders: under16Orders/);
  assert.match(submit, /declaration_snapshot: guardianSnapshot/);
  assert.match(submit, /submitted_on_malta: submittedOnMalta/);
});

test("staff prints before verifying guardian presence and signed A4; payment remains blocked", () => {
  assert.match(print, /pendingGuardianConsentGap/);
  assert.match(review, /participant\.under18AtSubmission && application\.printConfirmedAt/);
  assert.match(review, /guardianSignoffReady/);
  assert.match(review, /disabled=\{!allReady \|\| !guardianSignoffReady \|\| !application\.printConfirmedAt/);
  assert.match(submit, /pendingGuardianConsentGap\([\s\S]*guardianParticipants,[\s\S]*true,/);
  assert.match(policy, /guardian_present_verified_at/);
  assert.match(policy, /guardian_cosign_verified_at/);
});
