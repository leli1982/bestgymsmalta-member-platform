import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("membership review and print payloads visibly carry All Access or Single Gym target", () => {
  const reviewRoute = read("app/api/system/members/applications/[applicationId]/route.ts");
  const printRoute = read("app/api/system/members/applications/[applicationId]/print/route.ts");
  const reviewModal = read("components/staff/StaffMembershipReviewModal.tsx");
  const printSheet = read("components/staff/MembershipA4Sheet.tsx");

  for (const source of [reviewRoute, printRoute]) {
    assert.match(source, /access_scope/);
    assert.match(source, /access_gym_id/);
    assert.match(source, /normalizedAccessScope/);
    assert.match(source, /Access:/);
    assert.match(source, /Single Gym/);
    assert.match(source, /All Access/);
    assert.match(source, /enrollmentGymName:\s*visibleGymAndAccess/);
  }

  assert.match(reviewModal, /application\.enrollmentGymName/);
  assert.match(printSheet, /application\.enrollmentGymName/);
});
