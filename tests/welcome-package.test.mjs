import test from "node:test";
import assert from "node:assert/strict";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";
import { readFileSync } from "node:fs";

const enrollRoute = readFileSync(new URL("../app/api/system/members/enroll/route.ts", import.meta.url), "utf8");

test("welcome email contains app link and accepted declaration text", () => {
  const email = buildWelcomeEmail({
    memberName: "Test Member",
    appUrl: "https://example.test/login",
    declarations: {
      gymRules: { versionNo: 7, body: "Respect the gym and return weights after use." },
      health: { versionNo: 3, body: "Train responsibly and disclose relevant health concerns." },
      privacy: { versionNo: 5, body: "Your membership data is processed for gym operations." },
      guardian: { versionNo: 2, body: "Guardian consent applies where required." },
    },
  });
  assert.match(email.subject, /Welcome/i);
  assert.match(email.text, /https:\/\/example\.test\/login/);
  assert.match(email.text, /Gym Rules/i);
  assert.match(email.text, /Health Declaration/i);
  assert.match(email.text, /Privacy/i);
  assert.match(email.text, /Guardian Declaration/i);
  assert.match(email.text, /Respect the gym/);
  assert.match(email.html, /https:\/\/example\.test\/login/);
});

test("welcome email omits guardian section when no guardian declaration was accepted", () => {
  const email = buildWelcomeEmail({
    memberName: "Adult Member",
    appUrl: "https://example.test/login",
    declarations: {
      gymRules: { versionNo: 1, body: "Rules" },
      health: { versionNo: 1, body: "Health" },
      privacy: { versionNo: 1, body: "Privacy" },
    },
  });
  assert.doesNotMatch(email.text, /Guardian Declaration/);
});

test("activation sends welcome package only after successful activation and never makes activation depend on mail success", () => {
  assert.match(enrollRoute, /application_kind/);
  assert.match(enrollRoute, /declaration_snapshot/);
  assert.match(enrollRoute, /sendWelcomePackagesBestEffort/);
  assert.match(enrollRoute, /bestEffortSyncGoogleWalletMembers/);
  assert.match(enrollRoute, /return NextResponse\.json\(\{/);
  assert.doesNotMatch(enrollRoute, /await sendWelcomePackagesBestEffort\([^)]*\)(?!\.catch)/s);
});
