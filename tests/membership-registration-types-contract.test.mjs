import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const typesPath = new URL("../lib/membershipRegistrationTypes.ts", import.meta.url);

test("shared membership registration types are defined in one canonical module", () => {
  assert.ok(fs.existsSync(typesPath), "membershipRegistrationTypes.ts must exist");
  const source = fs.readFileSync(typesPath, "utf8");

  for (const name of [
    "PriceEntry",
    "PublishedDeclarationSnapshot",
    "PublicEnrollmentConfig",
    "GuardianDetails",
    "RegistrationParticipant",
    "ParticipantDeclarationAcceptance",
    "RegistrationDraft",
    "OfflineVerificationSnapshot",
  ]) {
    assert.match(source, new RegExp(`export type ${name}\\b`));
  }

  assert.match(source, /guardian\?: GuardianDetails/);
  assert.match(source, /mobile: string/);
  assert.match(source, /photos: Array<File \| null>/);
  assert.match(source, /declarations: ParticipantDeclarationAcceptance\[\]/);
});
