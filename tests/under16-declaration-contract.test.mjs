import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { UNDER16_SUPERVISION_CLAUSE } from "../lib/guardianConsentPolicy.ts";

const form = readFileSync("components/membership/RegistrationForm.tsx", "utf8");
const declaration = readFileSync("components/membership/RegistrationDeclarations.tsx", "utf8");
const staff = readFileSync("app/api/system/members/registration/route.ts", "utf8");
const publicSubmit = readFileSync("app/api/public/membership-enrollment/submit/route.ts", "utf8");
const printSheet = readFileSync("components/staff/MembershipA4Sheet.tsx", "utf8");
const overflow = readFileSync("components/staff/MembershipPrintOverflowPreview.tsx", "utf8");

test("all under-18 applicants see guardian consent; only under-16 applicants see supervision clause", () => {
  assert.match(form, /showGuardian=\{under18\}/);
  assert.match(form, /showUnder16Supervision=\{under16\}/);
  assert.match(form, /\{under18 && membershipType !== "couples" \? \(/);
  assert.match(form, /membershipType === "couples" && under18/);
  assert.match(declaration, /showUnder16Supervision &&/);
  assert.match(declaration, /UNDER16_SUPERVISION_CLAUSE/);
  assert.match(UNDER16_SUPERVISION_CLAUSE, /under 16.*accompanied by a responsible adult/i);
});

test("both staff and public submissions snapshot age-specific guardian terms prospectively", () => {
  assert.match(staff, /under18AtSubmission && !settings\.declarations\.guardian/);
  assert.match(staff, /serverParticipants\.some\(\(\{ participant \}\) => isUnder18On/);
  assert.match(staff, /supervisionUnder16Orders/);
  assert.match(staff, /supervisionUnder16Text: UNDER16_SUPERVISION_CLAUSE/);
  assert.match(publicSubmit, /under18Flags\.push\(isUnder18On/);
  assert.match(publicSubmit, /under16Flags\.push\(isUnder16On/);
  assert.match(publicSubmit, /under18Flags\.some\(Boolean\) && !guardianDeclaration/);
  assert.match(publicSubmit, /guardianDeclaration && under18Flags\.some\(Boolean\)/);
  assert.match(publicSubmit, /supervisionUnder16Orders: under16Flags\.flatMap/);
  assert.match(publicSubmit, /supervisionUnder16Text: UNDER16_SUPERVISION_CLAUSE/);
});

test("new A4 sheets include guardian declaration under 18, append supervision only to under-16 person; old snapshots remain unchanged", () => {
  assert.match(printSheet, /hasProspectiveGuardianPolicy/);
  assert.match(printSheet, /participant\.under18AtSubmission/);
  assert.match(printSheet, /guardianSnapshot\?\.supervisionUnder16Orders\?\.includes\(participant\.participantOrder\)/);
  assert.match(printSheet, /guardianSnapshot\.supervisionUnder16Text/);
  assert.match(printSheet, /isUnder16On\(participant\.dateOfBirth, application\.startDate\)/);
  assert.match(overflow, /supervisionUnder16Text: UNDER16_SUPERVISION_CLAUSE/);
  assert.match(printSheet, /<Signature title="Guardian Signature" \/>/);
});
