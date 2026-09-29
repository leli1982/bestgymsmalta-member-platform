import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registrationPath = new URL("../components/membership/RegistrationForm.tsx", import.meta.url);
const photoPath = new URL("../components/membership/LivePhotoCapture.tsx", import.meta.url);
const declarationsPath = new URL("../components/membership/RegistrationDeclarations.tsx", import.meta.url);
const warningPath = new URL("../components/membership/RegistrationDocumentWarning.tsx", import.meta.url);

function readRequired(path, label) {
  assert.ok(fs.existsSync(path), `${label} must exist`);
  return fs.readFileSync(path, "utf8");
}

test("shared registration form owns membership, duration, participant and declaration state in memory", () => {
  const source = readRequired(registrationPath, "RegistrationForm");
  assert.match(source, /mode:\s*["']tablet["']\s*\|\s*["']staff["']/);
  assert.match(source, /membershipType/i);
  assert.match(source, /durationKey/i);
  assert.match(source, /participantCountForType/);
  assert.match(source, /validateRegistrationParticipant/);
  assert.match(source, /RegistrationDocumentWarning/);
  assert.match(source, /RegistrationDeclarations/);
  assert.match(source, /LivePhotoCapture/);
  assert.match(source, /amountCents/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /URLSearchParams|searchParams/);
});

test("document warning appears from the canonical membership requirements before personal details continue", () => {
  const source = readRequired(warningPath, "RegistrationDocumentWarning");
  assert.match(source, /requiredDocumentMessage/);
  assert.match(source, /You will need at reception/i);
  assert.match(source, /acknowledge|understand|continue/i);
});

test("registration renders a second participant for Couples and guardian details for under-18 applicants", () => {
  const source = readRequired(registrationPath, "RegistrationForm");
  assert.match(source, /couples/i);
  assert.match(source, /participantCountForType/);
  assert.match(source, /isUnder18On/);
  assert.match(source, /guardian/i);
  assert.match(source, /Guardian full name|Parent.*guardian/i);
});

test("declarations show the exact published wording and require per-participant acceptance", () => {
  const source = readRequired(declarationsPath, "RegistrationDeclarations");
  assert.match(source, /gymRules/i);
  assert.match(source, /privacy/i);
  assert.match(source, /health/i);
  assert.match(source, /body/);
  assert.match(source, /checked/);
  assert.match(source, /onChange/);
});

test("tablet live photo capture is camera-only WebP with retry, retake and explicit use", () => {
  const source = readRequired(photoPath, "LivePhotoCapture");
  assert.match(source, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(source, /facingMode:\s*["']user["']/);
  assert.match(source, /audio:\s*false/);
  assert.match(source, /document\.createElement\(["']canvas["']\)/);
  assert.match(source, /image\/webp/);
  assert.match(source, /Take Photo/i);
  assert.match(source, /Retake/i);
  assert.match(source, /Use Photo/i);
  assert.match(source, /Try Camera Again/i);
  assert.doesNotMatch(source, /type=["']file["']/i);
});

test("identity early-check blocks active members and allows expired or inactive cases for reception review", () => {
  const source = readRequired(registrationPath, "RegistrationForm");
  assert.match(source, /\/api\/public\/membership-enrollment\/identity-check/);
  assert.match(source, /onBlur/);
  assert.match(source, /active/);
  assert.match(source, /already.*active|active.*membership/i);
  assert.match(source, /expired_inactive/);
  assert.match(source, /reception.*review|review.*reception/i);
});

test("tablet requires a photo while staff mode can use the configured photo policy", () => {
  const source = readRequired(registrationPath, "RegistrationForm");
  assert.match(source, /staffPhotoPolicy/);
  assert.match(source, /required["']\s*\|\s*["']optional/);
  assert.match(source, /mode\s*===\s*["']tablet["']/);
  assert.match(source, /photos/i);
  assert.match(source, /onSubmit/);
});

test("Couples enter one shared household address, but still have two personal records", () => {
  const source = readRequired(registrationPath, "RegistrationForm");
  assert.match(source, /membershipType !== "couples" \|\| index === 0/);
  assert.match(source, /Shared home address — enter once for both applicants/);
  assert.match(source, /Shared home address entered for Applicant 1 applies to both applicants/);
  assert.match(source, /withCouplesSharedAddress\(membershipType, participants\)/);
  assert.match(source, /withCouplesSharedAddress\("couples", updated\)/);
  assert.match(source, /Reception must visually verify/);
});
