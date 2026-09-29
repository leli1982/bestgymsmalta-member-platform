import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3119";
const artifacts = "test-artifacts/staff-minor-renewal";
const server = spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3119", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
}
let browser;
let page;
let submitted = null;
const errors = [];
try {
  await mkdir(artifacts, { recursive: true });
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin + "/staff")).ok) break; } catch {}
    if (i > 150 || server.exitCode !== null) throw new Error("Next did not start: " + logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 920, height: 1100 } });
  await context.route("**/api/system/auth", route => route.fulfill({ json: {
    authenticated: true,
    user: { id: "staff-test", username: "staff", displayName: "TEST Staff",
      gymId: "gym-one", isSuperAdmin: false,
      permissions: ["members.renew", "members.create", "members.view"] },
  } }));
  await context.route("**/api/gyms", route => route.fulfill({ json: {
    gyms: [{ id: "gym-one", name: "Birkirkara", status: "active" }],
  } }));
  await context.route("**/api/system/members/available-prices", route => route.fulfill({ json: {
    catalogVersionId: "catalog-test",
    entries: [
      { membershipType: "single", durationKey: "1_month", amountCents: 5000 },
      { membershipType: "student", durationKey: "1_month", amountCents: 3000 },
    ],
    guardianDeclaration: { id: "guardian-v3-test", versionNo: 3,
      body: "Parent / Guardian Declaration. The guardian consents to this renewal.",
      contentSha256: "guardian-test-hash" },
  } }));
  await context.route("**/api/system/members/search**", route => route.fulfill({ json: {
    candidates: [{ id: "existing-minor-test", memberNumber: "BGMTESTMINOR",
      fullName: "Fictional Minor", firstName: "Fictional", lastName: "Minor",
      status: "expired", membershipExpiry: "2026-09-01", mobile: "79000001",
      phone: "79000001", email: "minor@example.test", addressLine1: "Test Street",
      town: "Mosta", idNumber: "TESTMINOR01", dateOfBirth: "2013-02-07",
      nextOfKin: "Fictional Guardian", officialPhotoPath: null }],
  } }));
  await context.route("**/api/system/members/enroll", route => {
    if (route.request().method() !== "POST") return route.fulfill({ status: 405 });
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 409, json: { error: "Browser test intentionally stops before saving." } });
  });
  page = await context.newPage();
  page.on("pageerror", err => errors.push(err.message));
  await page.goto(origin + "/staff/members/enroll?kind=renewal&memberNumber=BGMTESTMINOR");
  await page.getByText("Confirmed existing member", { exact: true }).waitFor();
  await page.getByLabel("Membership Type").selectOption("student");
  await page.getByLabel("Starting Date").fill("2026-09-25");
  await page.getByLabel("Staff Name").fill("TEST Staff");
  await page.getByText("Parent / Guardian Declaration · v3").waitFor();
  await page.getByText(/members under 16 must be accompanied by a responsible adult/).waitFor();
  await page.getByLabel("Guardian full name").fill("Fictional Guardian");
  await page.getByLabel("Guardian ID / passport number").fill("GUARD123");
  await page.getByLabel("Relationship").fill("Parent");
  await page.getByLabel("Guardian mobile").fill("79000002");
  await page.getByLabel("Guardian email").fill("guardian@example.test");
  await page.getByLabel("Guardian address").fill("Test Street");
  await page.getByRole("button", { name: "SUBMIT MEMBERSHIP APPLICATION" }).click();
  await page.getByText(/guardian consent, complete guardian details and confirmation/).waitFor();
  assert.equal(submitted, null, "Submission must be blocked until the guardian has reviewed the declaration");
  await page.getByRole("checkbox", { name: /I confirm that the parent \/ legal guardian has reviewed/ }).check();
  await page.getByRole("button", { name: "SUBMIT MEMBERSHIP APPLICATION" }).click();
  await page.getByText("Browser test intentionally stops before saving.").waitFor();
  assert.equal(submitted.guardianDeclarationVersionId, "guardian-v3-test");
  assert.equal(submitted.participants.length, 1);
  assert.equal(submitted.participants[0].existingMemberId, "existing-minor-test");
  assert.equal(submitted.participants[0].guardian.fullName, "Fictional Guardian");
  assert.equal(submitted.participants[0].guardianDeclarationPresented, true);
  assert.deepEqual(errors, [], "Minor renewal form must render without client errors");
  await page.screenshot({ path: artifacts + "/minor-renewal-guardian.png", fullPage: true });
  console.log("PASS minor renewal guardian form, published terms and submission requirement");
} catch (error) {
  if (page) await page.screenshot({ path: artifacts + "/failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
