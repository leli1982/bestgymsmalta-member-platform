import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renewal = readFileSync(
  new URL("../components/staff/StaffRenewalEnrollmentPage.tsx", import.meta.url),
  "utf8",
);

test("renewal keeps an existing date of birth locked but allows a missing one to be entered", () => {
  assert.match(
    renewal,
    /readOnly=\{kind === ["']renewal["'] && Boolean\(participant\.dateOfBirth\)\}/,
    "renewal DOB must only be read-only when the existing member already has a DOB",
  );
  assert.doesNotMatch(
    renewal,
    /readOnly=\{kind === ["']renewal["']\}/,
    "a renewal member with no stored DOB must not be trapped in a required-but-read-only field",
  );
});
