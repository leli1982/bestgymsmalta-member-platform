import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";
import { buildGymRulesPdf, gymRulesPdfFilename } from "../lib/gymRulesPdf.ts";

const enrollRoute = readFileSync(new URL("../app/api/system/members/enroll/route.ts", import.meta.url), "utf8");
const walletSync = readFileSync(new URL("../lib/googleWalletSync.ts", import.meta.url), "utf8");
const welcomePackage = readFileSync(new URL("../lib/welcomePackage.ts", import.meta.url), "utf8");
const welcomeMailer = readFileSync(new URL("../lib/welcomeMailer.ts", import.meta.url), "utf8");

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

test("Gym Rules PDF is a real A4 PDF carrying the accepted version and exact rule source", () => {
  const body = "Respect the gym and return weights after use.\nNo abusive behaviour is permitted.";
  const declaration = { versionNo: 7, body };
  const pdf = buildGymRulesPdf(declaration);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(gymRulesPdfFilename(declaration), "BestGymsMalta-Gym-Rules-v7.pdf");
  const source = pdf.toString("latin1");
  assert.match(source, /Version 7/);
  assert.ok(source.includes(`BGM-Gym-Rules-UTF8-Base64: ${Buffer.from(body, "utf8").toString("base64")}`));
  assert.match(source, /Respect the gym and return weights after use\./);
  assert.match(source, /No abusive behaviour is permitted\./);
});

test("welcome mailer attaches the accepted Gym Rules as a PDF", () => {
  assert.match(welcomeMailer, /buildGymRulesPdf\(gymRules!\)/);
  assert.match(welcomeMailer, /gymRulesPdfFilename\(gymRules!\)/);
  assert.match(welcomeMailer, /attachments:\s*\[/);
  assert.match(welcomeMailer, /contentType:\s*"application\/pdf"/);
  assert.match(welcomeMailer, /Accepted Gym Rules are missing from the welcome package/);
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
  assert.match(welcomePackage, /snapshot\.gymRules \|\| snapshot\.gym_rules/);
});
