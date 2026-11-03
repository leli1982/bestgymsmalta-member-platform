import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildWelcomeEmail } from "../lib/welcomeEmailCore.ts";
import { buildGymRulesPdf, gymRulesPdfFilename } from "../lib/gymRulesPdf.ts";

const enrollRoute = readFileSync(new URL("../app/api/system/members/enroll/route.ts", import.meta.url), "utf8");
const printRoute = readFileSync(new URL("../app/api/system/members/applications/[applicationId]/print/route.ts", import.meta.url), "utf8");
const walletSync = readFileSync(new URL("../lib/googleWalletSync.ts", import.meta.url), "utf8");
const welcomePackage = readFileSync(new URL("../lib/welcomePackage.ts", import.meta.url), "utf8");
const welcomeMailer = readFileSync(new URL("../lib/welcomeMailer.ts", import.meta.url), "utf8");
const declarationPdfUrl = new URL("../lib/declarationPdf.ts", import.meta.url);
const membershipFormPdfUrl = new URL("../lib/membershipFormPdf.ts", import.meta.url);
const printableLoaderUrl = new URL("../lib/printableMembershipApplication.ts", import.meta.url);

test("welcome email contains member number, app link and accepted declaration text", () => {
  const email = buildWelcomeEmail({
    memberName: "Test Member",
    memberNumber: "BGM0123456",
    appUrl: "https://example.test/login",
    applicationKind: "new",
    declarations: {
      gymRules: { versionNo: 7, body: "Respect the gym and return weights after use." },
      health: { versionNo: 3, body: "Train responsibly and disclose relevant health concerns." },
      privacy: { versionNo: 5, body: "Your membership data is processed for gym operations." },
      guardian: { versionNo: 2, body: "Guardian consent applies where required." },
    },
  });
  assert.match(email.subject, /Welcome/i);
  assert.match(email.text, /BGM0123456/);
  assert.match(email.text, /membership number/i);
  assert.match(email.html, /BGM0123456/);
  assert.match(email.html, /membership number/i);
  assert.match(email.text, /https:\/\/example\.test\/login/);
  assert.match(email.text, /Gym Rules/i);
  assert.match(email.text, /Health Declaration/i);
  assert.match(email.text, /Privacy/i);
  assert.match(email.text, /Guardian Declaration/i);
  assert.match(email.text, /Respect the gym/);
  assert.match(email.html, /https:\/\/example\.test\/login/);
});

test("renewal welcome email uses renewal-specific confirmation copy", () => {
  const email = buildWelcomeEmail({
    memberName: "Renewing Member",
    memberNumber: "BGM0765432",
    appUrl: "https://example.test/login",
    applicationKind: "renewal",
    declarations: {
      gymRules: { versionNo: 9, body: "Rules" },
      health: { versionNo: 4, body: "Health" },
      privacy: { versionNo: 6, body: "Privacy" },
    },
  });
  assert.match(email.subject, /renew/i);
  assert.match(email.text, /renewed/i);
  assert.doesNotMatch(email.text, /registering for the BestGymsMalta member app/i);
});

test("welcome email omits guardian section when no guardian declaration was accepted", () => {
  const email = buildWelcomeEmail({
    memberName: "Adult Member",
    memberNumber: "BGM0765432",
    appUrl: "https://example.test/login",
    applicationKind: "new",
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

test("generic declaration PDF preserves title, version and exact accepted source", async () => {
  assert.ok(existsSync(declarationPdfUrl), "generic declaration PDF builder must exist");
  const { buildDeclarationPdf, declarationPdfFilename } = await import("../lib/declarationPdf.ts");
  const body = "I confirm the health declaration exactly as accepted.";
  const input = {
    title: "Health Declaration",
    filenameLabel: "Health-Declaration",
    sourceKey: "Health",
    declaration: { versionNo: 3, body },
  };
  const pdf = buildDeclarationPdf(input);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(declarationPdfFilename(input), "BestGymsMalta-Health-Declaration-v3.pdf");
  const source = pdf.toString("latin1");
  assert.match(source, /Health Declaration/);
  assert.match(source, /Version 3/);
  assert.ok(source.includes(`BGM-Health-UTF8-Base64: ${Buffer.from(body, "utf8").toString("base64")}`));
});

test("welcome mailer attaches all required declaration PDFs and guardian only when present", () => {
  assert.match(welcomeMailer, /Health Declaration/);
  assert.match(welcomeMailer, /Privacy \/ GDPR/);
  assert.match(welcomeMailer, /Guardian Consent/);
  assert.match(welcomeMailer, /input\.declarations\.health/);
  assert.match(welcomeMailer, /input\.declarations\.privacy/);
  assert.match(welcomeMailer, /input\.declarations\.guardian/);
  assert.match(welcomeMailer, /if\s*\(input\.declarations\.guardian\)/);
  assert.match(welcomeMailer, /buildDeclarationPdf/);
  assert.match(welcomeMailer, /declarationPdfFilename/);
});

test("completed membership form PDF carries transaction, member, payment and declaration version details", async () => {
  assert.ok(existsSync(membershipFormPdfUrl), "membership form PDF builder must exist");
  const { buildMembershipFormPdf, membershipFormPdfFilename } = await import("../lib/membershipFormPdf.ts");
  const participant = {
    id: "participant-1", participantOrder: 1, firstName: "Test", lastName: "Member",
    addressLine1: "1 Test Street", addressLine2: "", town: "Mosta", postcode: "MST 0001",
    idNumber: "123456M", dateOfBirth: "1982-02-07", phone: "79000000", email: "test@example.test",
    nextOfKin: "Test Kin 79000001", memberId: "member-1", memberNumber: "BGM0123456",
    barcode: "CARD0001", photoUrl: null, under18AtSubmission: false, guardianName: "",
    guardianIdNumber: "", guardianRelationship: "", guardianPhone: "", guardianEmail: "",
    guardianAddress: "", idVerified: true, studentEligibilityVerified: false,
    guardianPresentVerified: false, guardianCosignVerified: false,
  };
  const application = {
    id: "app-1", applicationReference: "APP-2026-0001", kind: "renewal", membershipType: "regular",
    durationKey: "12m", startDate: "2026-11-03", expiryDate: "2027-11-02", status: "activated",
    submittedAt: "2026-11-03T10:00:00Z", paymentReceivedAt: "2026-11-03T10:10:00Z",
    activatedAt: "2026-11-03T10:12:00Z", applicationStaffName: "Kirkop", activationStaffName: "Kirkop",
    enrollmentGymId: "gym-kirkop", enrollmentGymName: "Kirkop Fitness · Access: All Access",
    basePriceCents: 42500, currency: "EUR", discountCode: "LOYAL10", discountPercentage: 10,
    discountAmountCents: 4250, finalAmountCents: 38250, paymentMethod: "card", paymentOtherText: null,
    paymentStaffName: "Kirkop", declarationSnapshot: {
      gymRules: { versionNo: 7, body: "Rules accepted" },
      health: { versionNo: 3, body: "Health accepted" },
      privacy: { versionNo: 5, body: "Privacy accepted" },
    }, sameAddressVerified: false, participants: [participant],
  };
  const pdf = buildMembershipFormPdf(application, participant);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(membershipFormPdfFilename(application, participant), "BestGymsMalta-Membership-APP-2026-0001-BGM0123456.pdf");
  const source = pdf.toString("latin1");
  for (const expected of ["APP-2026-0001", "BGM0123456", "Test Member", "2026-11-03", "2027-11-02", "382.50", "Version 7", "Version 3", "Version 5"]) {
    assert.ok(source.includes(expected), `membership form PDF must include ${expected}`);
  }
});

test("Staff print route and welcome package share the printable application loader", () => {
  assert.ok(existsSync(printableLoaderUrl), "shared printable application loader must exist");
  assert.match(printRoute, /loadPrintableMembershipApplication/);
  assert.match(welcomePackage, /loadPrintableMembershipApplication/);
});

test("welcome mailer accepts and attaches the completed membership form PDF", () => {
  assert.match(welcomeMailer, /membershipFormPdf/);
  assert.match(welcomeMailer, /BestGymsMalta-Membership/);
});

test("welcome package resolves and sends each activated member's permanent BGM number", () => {
  assert.match(welcomePackage, /member_number/);
  assert.match(welcomePackage, /memberNumber/);
  assert.match(welcomePackage, /bgm_memberships/);
  assert.match(welcomePackage, /bgm_membership_members/);
});

test("successful activation flows through the existing post-activation hook", () => {
  assert.match(enrollRoute, /bestEffortSyncGoogleWalletMembers\(walletMemberIds\)/);
  assert.match(walletSync, /sendWelcomePackagesForRecentlyActivatedMembersBestEffort/);
  assert.match(walletSync, /Welcome email failure must never undo or fail the membership mutation/);
});

test("welcome delivery supports new and renewal applications, stays recent-only, and audits sent declaration versions", () => {
  assert.match(welcomePackage, /application_kind/);
  assert.doesNotMatch(welcomePackage, /application_kind\s*!==\s*["']new["']/);
  assert.doesNotMatch(welcomePackage, /\.eq\(["']application_kind["'],\s*["']new["']\)/);
  assert.match(welcomePackage, /RECENT_ACTIVATION_WINDOW_MS/);
  assert.match(welcomePackage, /membership\.welcome_email\.sent/);
  assert.match(welcomePackage, /alreadySent/);
  assert.match(welcomePackage, /bgm_membership_declaration_versions/);
  assert.match(welcomePackage, /status[^\n]*"published"/);
  assert.match(welcomePackage, /snapshot\.gymRules \|\| snapshot\.gym_rules/);
  assert.match(welcomePackage, /declarationVersions/);
  assert.match(welcomePackage, /applicationKind/);
});
