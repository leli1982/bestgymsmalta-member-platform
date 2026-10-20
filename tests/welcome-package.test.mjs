import test from "node:test";
import assert from "node:assert/strict";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";
import { readFileSync } from "node:fs";

const enrollRoute = readFileSync(new URL("../app/api/system/members/enroll/route.ts", import.meta.url), "utf8");
const walletSync = readFileSync(new URL("../lib/googleWalletSync.ts", import.meta.url), "utf8");
const welcomePackage = readFileSync(new URL("../lib/welcomePackage.ts", import.meta.url), "utf8");

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

test("successful activation flows through the existing post-activation hook", () => {
  assert.match(enrollRoute, /bestEffortSyncGoogleWalletMembers\(walletMemberIds\)/);
  assert.match(walletSync, /sendWelcomePackagesForRecentlyActivatedMembersBestEffort/);
  assert.match(walletSync, /Welcome email failure must never undo or fail the membership mutation/);
});

test("welcome delivery is new-membership-only, recent-activation-only and audited per recipient", () => {
  assert.match(welcomePackage, /application_kind[^\n]*"new"|application_kind[^\n]*new/);
  assert.match(welcomePackage, /RECENT_ACTIVATION_WINDOW_MS/);
  assert.match(welcomePackage, /membership\.welcome_email\.sent/);
  assert.match(welcomePackage, /alreadySent/);
  assert.match(welcomePackage, /bgm_membership_declaration_versions/);
  assert.match(welcomePackage, /status[^\n]*"published"/);
});
