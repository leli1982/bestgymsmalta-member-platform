import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3118";
const memberId = "00000000-0000-4000-8000-000000000123";
const artifacts = "test-artifacts/super-admin-member-editor";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3118", "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { output = (output + data).slice(-5000); });
let browser;
try {
  await mkdir(artifacts, { recursive: true });
  for (let n = 0; ; n++) {
    try { if ((await fetch(origin + "/staff/admin/members/" + memberId)).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next did not start: " + output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const clientErrors = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  let member = {
    id: memberId, memberNumber: "BGM0000123", firstName: "Alex", lastName: "Borg",
    fullName: "Alex Borg", email: "alex@example.test", mobile: "99000000",
    dateOfBirth: "1988-02-29", idNumber: "X1234", addressLine1: "Test Road",
    addressLine2: "", town: "Mosta", postcode: "MST 0000", nextOfKin: "Jamie Borg",
    status: "active", membershipExpiry: "2026-12-31", enrollmentDate: null,
    membershipPeriod: null, enrollmentGymId: "bgm-mosta",
    originalEnrollmentGym: "Mosta", legacyPkCustomer: "PK-OLD-001",
    photoUrl: null, updatedAt: "2026-09-23T08:00:00.000Z",
  };
  const gyms = [
    { id: "bgm-mosta", name: "Mosta", status: "active" },
    { id: "bgm-marsa", name: "Marsa", status: "active" },
  ];
  const memberships = [{
    id: "membership-test-1", role: "primary", membershipType: "single",
    duration: "1_month", startDate: "2026-12-01", expiryDate: "2026-12-31",
    enrollmentGymId: "bgm-mosta", status: "active",
    application: {
      application_reference: "TEST-0001", base_price_cents: 5500,
      discount_amount_cents: 500, final_amount_cents: 5000,
      currency: "EUR", payment_method: "card", payment_other_text: null,
      payment_received_at: "2026-12-01T10:00:00Z",
    },
  }];
  let dateEdit = {
    allowed: true,
    reason: "Current individual membership identified; historical payments are preserved.",
    membershipId: "00000000-0000-4000-8000-000000000456",
    expectedMembershipUpdatedAt: "2026-09-23T08:00:00.000Z",
    startDate: "2026-12-01",
    expiryDate: "2026-12-31",
  };
  let dateChange = null;
  await context.route("**/api/system/admin/members/" + memberId + "/membership-dates", async (route) => {
    assert.equal(route.request().method(), "PATCH");
    dateChange = route.request().postDataJSON();
    assert.deepEqual(Object.keys(dateChange).sort(), [
      "expectedMemberUpdatedAt", "expectedMembershipUpdatedAt", "expiryDate", "membershipId", "startDate",
    ]);
    assert.equal(dateChange.expectedMemberUpdatedAt, member.updatedAt);
    assert.equal(dateChange.membershipId, dateEdit.membershipId);
    assert.equal(dateChange.expectedMembershipUpdatedAt, dateEdit.expectedMembershipUpdatedAt);
    assert.equal(dateChange.startDate, "2026-12-01");
    assert.equal(dateChange.expiryDate, "2027-01-31");
    member = { ...member, membershipExpiry: dateChange.expiryDate, updatedAt: "2026-09-23T08:03:00.000Z" };
    memberships[0].expiryDate = dateChange.expiryDate;
    dateEdit = { ...dateEdit, expiryDate: dateChange.expiryDate, expectedMembershipUpdatedAt: "2026-09-23T08:03:00.000Z" };
    return route.fulfill({ json: { ok: true, changed: true, updatedAt: member.updatedAt } });
  });
  let received = null;
  let gymChange = null;
  await context.route("**/api/system/admin/members/" + memberId + "/enrollment-gym", async (route) => {
    assert.equal(route.request().method(), "PATCH");
    gymChange = route.request().postDataJSON();
    assert.deepEqual(Object.keys(gymChange).sort(), ["enrollmentGymId", "expectedUpdatedAt"]);
    assert.equal(gymChange.expectedUpdatedAt, member.updatedAt);
    assert.equal(gymChange.enrollmentGymId, "bgm-marsa");
    member = { ...member, enrollmentGymId: "bgm-marsa", updatedAt: "2026-09-23T08:02:00.000Z" };
    return route.fulfill({ json: { ok: true, changed: true, updatedAt: member.updatedAt } });
  });
  await context.route("**/api/system/admin/members/" + memberId, async (route) => {
    if (route.request().method() === "PATCH") {
      received = route.request().postDataJSON();
      assert.equal(received.expectedUpdatedAt, member.updatedAt);
      assert.equal(received.profile.firstName, "Jamie");
      for (const field of ["memberNumber", "membershipExpiry", "enrollmentGymId", "status", "cardBarcode", "price"]) {
        assert.equal(Object.hasOwn(received.profile, field), false, field + " must not be submitted");
      }
      member = { ...member, ...received.profile, fullName: received.profile.firstName + " " + received.profile.lastName, updatedAt: "2026-09-23T08:01:00.000Z" };
      return route.fulfill({ json: { ok: true, updatedAt: member.updatedAt } });
    }
    return route.fulfill({ json: { member, activeCardNumber: "CARD-0099", dateEdit, gyms, memberships } });
  });
  await page.goto(origin + "/staff/admin/members/" + memberId);
  await page.getByRole("heading", { name: "Member editor" }).waitFor();
  await page.getByText("BGM0000123", { exact: true }).first().waitFor();
  await page.getByText("CARD-0099", { exact: false }).first().waitFor();
  await page.getByText("PK-OLD-001", { exact: false }).first().waitFor();
  assert.equal(await page.locator("main").evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "member editor must fit narrow viewport");
  await page.screenshot({ path: artifacts + "/member-before-390.png", fullPage: true });
  await page.getByRole("textbox", { name: "First name" }).fill("Jamie");
  assert.equal(await page.getByText("You have unsaved changes.").count(), 1);
  await page.getByRole("button", { name: "Save personal details" }).click();
  await page.getByText("Personal details saved and audited.").waitFor();
  assert.equal(received.profile.firstName, "Jamie");
  assert.equal(member.memberNumber, "BGM0000123");
  assert.equal(member.membershipExpiry, "2026-12-31");
  await page.screenshot({ path: artifacts + "/member-after-390.png", fullPage: true });
  await page.getByRole("combobox", { name: "New enrollment gym" }).selectOption("bgm-marsa");
  assert.equal(await page.getByRole("button", { name: "Save enrollment gym" }).isEnabled(), true);
  await page.getByRole("button", { name: "Save enrollment gym" }).click();
  await page.getByText("Current enrollment gym changed and audited. Future visits will use this gym.").waitFor();
  await page.getByText("Marsa", { exact: true }).first().waitFor();
  assert.equal(gymChange.enrollmentGymId, "bgm-marsa");
  assert.equal(member.originalEnrollmentGym, "Mosta");
  assert.equal(memberships[0].enrollmentGymId, "bgm-mosta");
  assert.equal(member.memberNumber, "BGM0000123");
  assert.equal(await page.locator("main").evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: artifacts + "/member-gym-changed-390.png", fullPage: true });

  await page.getByLabel("Current membership expiry", { exact: true }).fill("2027-01-31");
  assert.equal(await page.getByRole("button", { name: "Save membership dates" }).isEnabled(), true);
  assert.equal(await page.getByRole("button", { name: "Save enrollment gym" }).isEnabled(), false);
  await page.getByRole("button", { name: "Save membership dates" }).click();
  await page.getByText("Membership dates corrected and audited. Current expiry updated; original payment history was not changed.").waitFor();
  assert.equal(dateChange.expiryDate, "2027-01-31");
  assert.equal(member.membershipExpiry, "2027-01-31");
  assert.equal(memberships[0].expiryDate, "2027-01-31");
  assert.equal(memberships[0].application.final_amount_cents, 5000);
  assert.equal(member.originalEnrollmentGym, "Mosta");
  assert.equal(member.memberNumber, "BGM0000123");
  await page.screenshot({ path: artifacts + "/member-dates-corrected-390.png", fullPage: true });
  assert.deepEqual(clientErrors, []);
  console.log("PASS separate profile, enrollment gym and current membership date corrections preserve original gym, payment records and permanent identity");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
