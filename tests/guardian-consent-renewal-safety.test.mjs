import assert from "node:assert/strict";
import test from "node:test";
import { pendingGuardianConsentGap } from "../lib/guardianConsentSafety.ts";

const day = "2026-09-25T12:46:06Z";
const person = {
  participant_order: 1, date_of_birth: "2013-02-07",
  under_18_at_submission: false,
  guardian_name: null, guardian_id_number: null, guardian_relationship: null,
  guardian_phone: null, guardian_email: null, guardian_address: null,
  guardian_present_verified_at: null, guardian_cosign_verified_at: null,
};
test("an underage legacy renewal cannot print or activate without consent", () => {
  assert.match(pendingGuardianConsentGap(day, null, [person]), /guardian consent was not recorded/i);
  assert.match(pendingGuardianConsentGap(day, null, [person], true), /guardian consent was not recorded/i);
});
test("a minor with captured guardian consent still needs verification before activation", () => {
  const p = {...person, under_18_at_submission:true, guardian_name:"Guardian", guardian_id_number:"ID",
    guardian_relationship:"Parent", guardian_phone:"Phone", guardian_email:"Email", guardian_address:"Address"};
  assert.equal(pendingGuardianConsentGap(day, {guardian:{body:"Consent"}}, [p]), null);
  assert.match(pendingGuardianConsentGap(day, {guardian:{body:"Consent"}}, [p], true), /co-sign/i);
  assert.equal(pendingGuardianConsentGap(day, {guardian:{body:"Consent"}}, [{
    ...p,guardian_present_verified_at:day,guardian_cosign_verified_at:day,
  }],true), null);
});
test("adults remain eligible without a guardian", () => {
  assert.equal(pendingGuardianConsentGap(day, null, [{...person,date_of_birth:"2008-09-25"}],true),null);
});