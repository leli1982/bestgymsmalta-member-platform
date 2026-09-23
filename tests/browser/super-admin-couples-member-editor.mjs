import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3119";
const memberId = "00000000-0000-4000-8000-000000000123";
const partnerId = "00000000-0000-4000-8000-000000000124";
const membershipId = "00000000-0000-4000-8000-000000000456";
const artifacts = "test-artifacts/super-admin-couples-editor";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3119", "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { output = (output + chunk).slice(-5000); });
let browser;
try {
  await mkdir(artifacts, { recursive: true });
  for (let n = 0;; n++) {
    try { if ((await fetch(origin + "/staff/admin/members/" + memberId)).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next did not start: " + output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [], confirmationTexts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => { confirmationTexts.push(dialog.message()); void dialog.accept(); });

  let member = {
    id: memberId, memberNumber: "BGM0000123", firstName: "Alex", lastName: "Test",
    fullName: "Alex Test", email: "alex@example.test", mobile: "",
    dateOfBirth: "", idNumber: "", addressLine1: "", addressLine2: "", town: "", postcode: "", nextOfKin: "",
    status: "active", membershipExpiry: "2026-12-31", enrollmentDate: "2026-11-01",
    membershipPeriod: "1_month", enrollmentGymId: "bgm-mosta",
    originalEnrollmentGym: "Mosta", legacyPkCustomer: "ORIGINAL-123",
    photoUrl: null, updatedAt: "2026-09-23T09:00:00.000Z",
    cancellationEffectiveDate: null, cancellationReason: "", cancellationRecordedAt: null,
  };
  let partner = {
    id: partnerId, fullName: "Taylor Test", memberNumber: "BGM0000124",
    status: "active", membershipExpiry: "2026-12-31",
    cancellationEffectiveDate: null, updatedAt: "2026-09-23T09:01:00.000Z",
  };
  let contractUpdatedAt = "2026-09-23T09:02:00.000Z";
  let jointEffectiveDate = null;
  let requestCount = 0;
  const transactions = [];
  const gyms = [{ id: "bgm-mosta", name: "Mosta", status: "active" }];
  const memberships = [{
    id: membershipId, role: "primary", membershipType: "couples", duration: "1_month",
    startDate: "2026-11-01", expiryDate: "2026-12-31", enrollmentGymId: "bgm-mosta",
    status: "active", participantCount: 2,
    application: { application_reference: "TEST-COUPLES-1", base_price_cents: 9000,
      discount_amount_cents: 0, final_amount_cents: 9000, currency: "EUR",
      payment_method: "card", payment_other_text: null, payment_received_at: "2026-09-20T10:00:00Z" },
  }];
  await context.route("**/api/system/admin/members/" + memberId + "/couples-cancellation", async (route) => {
    assert.equal(route.request().method(), "POST");
    const body = route.request().postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), [
      "action", "effectiveDate", "expectedMemberUpdatedAt", "expectedMembershipUpdatedAt",
      "expectedPartnerUpdatedAt", "membershipId", "partnerId", "reason",
    ]);
    assert.equal(body.membershipId, membershipId);
    assert.equal(body.partnerId, partnerId);
    assert.equal(body.expectedMemberUpdatedAt, member.updatedAt);
    assert.equal(body.expectedPartnerUpdatedAt, partner.updatedAt);
    assert.equal(body.expectedMembershipUpdatedAt, contractUpdatedAt);
    requestCount++;
    transactions.push(body);
    if (requestCount === 1) {
      return route.fulfill({ status: 409, json: { error: "A partner changed elsewhere. Reload both members." } });
    }
    if (body.action === "cancel") {
      assert.equal(body.effectiveDate, "2026-10-15");
      assert.equal(body.reason, "Requested jointly");
      jointEffectiveDate = body.effectiveDate;
      member = { ...member, cancellationEffectiveDate: jointEffectiveDate,
        cancellationReason: body.reason, updatedAt: "2026-09-23T09:03:00.000Z" };
      partner = { ...partner, cancellationEffectiveDate: jointEffectiveDate,
        updatedAt: "2026-09-23T09:04:00.000Z" };
      contractUpdatedAt = "2026-09-23T09:05:00.000Z";
    } else {
      assert.equal(body.action, "withdraw");
      assert.equal(body.effectiveDate, null);
      jointEffectiveDate = null;
      member = { ...member, cancellationEffectiveDate: null,
        cancellationReason: "", updatedAt: "2026-09-23T09:06:00.000Z" };
      partner = { ...partner, cancellationEffectiveDate: null,
        updatedAt: "2026-09-23T09:07:00.000Z" };
      contractUpdatedAt = "2026-09-23T09:08:00.000Z";
    }
    return route.fulfill({ json: { ok: true, changed: true, effectiveDate: jointEffectiveDate } });
  });
  await context.route("**/api/system/admin/members/" + memberId, async (route) => {
    if (route.request().method() !== "GET") throw new Error("Unexpected personal profile update");
    return route.fulfill({ json: {
      member, gyms, memberships, activeCardNumber: "CARD-ALEX",
      dateEdit: { allowed: false, reason: "Shared membership requires joint date correction.",
        membershipId: null, expectedMembershipUpdatedAt: null,
        startDate: "2026-11-01", expiryDate: "2026-12-31" },
      cancellationEdit: { allowed: false, reason: "Shared couples membership: use a joint action.",
        membershipId: null, expectedMembershipUpdatedAt: null, effectiveDate: jointEffectiveDate,
        canWithdraw: false, today: "2026-09-23" },
      couplesCancellationEdit: { allowed: true,
        reason: "Both partners and shared membership verified for joint action.",
        canWithdraw: Boolean(jointEffectiveDate), membershipId,
        expectedMembershipUpdatedAt: contractUpdatedAt,
        effectiveDate: jointEffectiveDate, today: "2026-09-23", expiryDate: "2026-12-31",
        partner: { id: partner.id, fullName: partner.fullName,
          memberNumber: partner.memberNumber, updatedAt: partner.updatedAt },
      },
    } });
  });
  await page.goto(origin + "/staff/admin/members/" + memberId);
  await page.getByRole("heading", { name: "Cancel shared couples membership — both partners" }).waitFor();
  await page.getByText("Alex Test (BGM0000123)", { exact: true }).last().waitFor();
  await page.getByText("Taylor Test (BGM0000124)", { exact: true }).waitFor();
  const jointButton = page.getByRole("button", { name: /(?:Cancel shared membership for BOTH now|Schedule cancellation for BOTH)/ });
  await page.getByRole("textbox", { name: "First name" }).fill("Edited");
  assert.equal(await jointButton.isDisabled(), true, "joint action must not discard unsaved profile draft");
  await page.getByRole("textbox", { name: "First name" }).fill("Alex");
  await page.getByLabel("Effective date — both partners").fill("2026-10-15");
  await page.getByRole("textbox", { name: "Notes (optional)", exact: true }).fill("Requested jointly");
  await jointButton.click();
  await page.getByText("A partner changed elsewhere. Reload both members.").waitFor();
  assert.equal(member.cancellationEffectiveDate, null, "failed action must not alter first member");
  assert.equal(partner.cancellationEffectiveDate, null, "failed action must not alter partner");
  assert.equal(jointEffectiveDate, null, "failed action must not alter shared membership");
  await jointButton.click();
  await page.getByText("Couples membership cancellation saved for both partners and audited.").waitFor();
  assert.equal(member.cancellationEffectiveDate, "2026-10-15");
  assert.equal(partner.cancellationEffectiveDate, "2026-10-15");
  assert.equal(jointEffectiveDate, "2026-10-15");
  assert.equal(member.membershipExpiry, "2026-12-31");
  assert.equal(partner.membershipExpiry, "2026-12-31");
  assert.equal(memberships[0].application.final_amount_cents, 9000);
  await page.screenshot({ path: artifacts + "/joint-pending-390.png", fullPage: true });
  await page.getByRole("button", { name: "Withdraw BOTH pending cancellations" }).click();
  await page.getByText("Pending couples cancellation withdrawn for both partners and audited.").waitFor();
  assert.equal(member.cancellationEffectiveDate, null);
  assert.equal(partner.cancellationEffectiveDate, null);
  assert.equal(jointEffectiveDate, null);
  assert.equal(transactions.length, 3);
  assert.equal(confirmationTexts.length, 3);
  assert.equal(confirmationTexts.every((message) =>
    message.includes("BGM0000123") && message.includes("BGM0000124")), true);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator("main").evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("PASS: fictional couples 390px UI, both identities confirmed, stale-response no-change, joint schedule and withdrawal");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
