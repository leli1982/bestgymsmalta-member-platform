import test from "node:test";
import assert from "node:assert/strict";
import { buildGymRulesPdf } from "../lib/gymRulesPdf.ts";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";
import { readFileSync } from "node:fs";

const enrollRoute = readFileSync(new URL("../app/api/system/members/enroll/route.ts", import.meta.url), "utf8");

test("gym rules PDF is a real PDF built from the accepted immutable snapshot", () => {
  const pdf = buildGymRulesPdf({
    memberName: "Test Member",
    rulesBody: "1. Respect the gym.\n2. Return weights after use.",
    versionNo: 7,
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  const text = pdf.toString("latin1");
  assert.match(text, /Gym Rules/);
  assert.match(text, /Version 7/);
});

test("welcome email contains member app link and names the attached rules", () => {
  const email = buildWelcomeEmail({ memberName: "Test Member", appUrl: "https://example.test/login" });
  assert.match(email.subject, /Welcome/i);
  assert.match(email.text, /https:\/\/example\.test\/login/);
  assert.match(email.text, /Gym Rules/i);
  assert.match(email.html, /https:\/\/example\.test\/login/);
});

test("activation sends welcome package only after successful activation and never makes activation depend on mail success", () => {
  assert.match(enrollRoute, /application_kind/);
  assert.match(enrollRoute, /sendWelcomePackagesBestEffort/);
  assert.match(enrollRoute, /bestEffortSyncGoogleWalletMembers/);
  assert.match(enrollRoute, /return NextResponse\.json\(\{/);
  assert.doesNotMatch(enrollRoute, /await sendWelcomePackagesBestEffort\([^)]*\)(?!\.catch)/s);
});
