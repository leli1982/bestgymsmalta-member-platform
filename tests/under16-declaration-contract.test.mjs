import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync("components/membership/RegistrationForm.tsx", "utf8");
const staff = readFileSync("app/api/system/members/registration/route.ts", "utf8");
const publicSubmit = readFileSync("app/api/public/membership-enrollment/submit/route.ts", "utf8");
const printSheet = readFileSync("components/staff/MembershipA4Sheet.tsx", "utf8");

test("shared registration shows the guardian declaration only below 16, preserving under-18 details", () => {
  assert.match(form, /showGuardian=\{under16\}/);
  assert.match(form, /\{under18 \? \(/);
  assert.match(staff, /isUnder16On\(participant.dateOfBirth, submittedOnMalta\) && !settings.declarations.guardian/);
  assert.match(staff, /serverParticipants.some\(\(\{ participant \}\) => isUnder16On/);
});

test("public submission requires and snapshots guardian wording only for under-16 participants", () => {
  assert.match(publicSubmit, /under18Flags.push\(isUnder18On/);
  assert.match(publicSubmit, /under16Flags.push\(isUnder16On/);
  assert.match(publicSubmit, /under16Flags.some\(Boolean\) && !guardianDeclaration/);
  assert.match(publicSubmit, /guardianDeclaration && under16Flags.some\(Boolean\)/);
});

test("each individual A4 sheet includes guardian declaration only when that participant was under 16", () => {
  assert.match(printSheet, /entry.key !== "guardian" \|\| isUnder16On\(participant.dateOfBirth, application.startDate\)/);
  assert.match(printSheet, /participant.under18AtSubmission &&/);
});
