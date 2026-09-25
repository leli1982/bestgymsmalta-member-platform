import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3110";
const artifacts = "test-artifacts/staff-enrollment-gym";
const staff = {
  id: "staff-browser", gymId: "gym-one", displayName: "Gym One Staff",
  isSuperAdmin: false, username: "staff", permissions: ["members.create"],
};
const admin = {
  id: "admin-browser", gymId: null, displayName: "Super Admin Browser",
  isSuperAdmin: true, username: "admin", permissions: [],
};
const gyms = [{ id: "gym-one", name: "Birkirkara" }, { id: "gym-two", name: "Mosta" }];
const configFor = (gym) => ({
  gym: { ...gym, shortName: gym.name, slug: gym.id },
  pricing: { versionId: "test-catalog", entries: [{
    membershipType: "single", durationKey: "1_month", amountCents: 4000,
    currency: "EUR", isActive: true,
  }] },
  declarations: Object.fromEntries(["gymRules", "privacy", "health", "guardian"].map((key) => [
    key, { id: key, contentKey: key === "gymRules" ? "gym_rules" : key,
      versionNo: 1, body: "Browser test declaration", contentSha256: key + "-sha" },
  ])),
});
const server = spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3110", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { serverOutput = (serverOutput + chunk).slice(-4000); });
}
let browser;
let page;
let currentUser = admin;
let lastSelectedGym = "";
let submittedGym = "";
const pageErrors = [];
const returnLink = () => page.getByRole("navigation", { name: "Staff Portal navigation" }).getByRole("link", { name: "Return to Staff Portal", exact: true });

try {
  await mkdir(artifacts, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin + "/staff")).ok) break; } catch {}
    if (attempt > 150 || server.exitCode !== null) throw new Error("Next did not start: " + serverOutput);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  await context.route("**/api/system/auth", (route) => route.fulfill({ json: {
    authenticated: true, user: currentUser,
  } }));
  await context.route("**/api/system/members/registration**", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      submittedGym = body.enrollmentGymId;
      assert.equal(body.draft.membershipType, "single");
      // Never create a real membership in this browser-only regression.
      return route.fulfill({ status: 409, json: { error: "Browser test intentionally stops before saving." } });
    }
    assert.equal(route.request().method(), "GET");
    const requested = new URL(route.request().url()).searchParams.get("gymId") || "";
    if (currentUser.isSuperAdmin) {
      if (!requested) return route.fulfill({ json: { config: null, gyms, systemUser: currentUser } });
      const chosen = gyms.find((gym) => gym.id === requested);
      assert.ok(chosen, "Super Admin must request a real selected gym");
      lastSelectedGym = requested;
      return route.fulfill({ json: { config: configFor(chosen), gyms, systemUser: currentUser } });
    }
    assert.equal(requested, "", "gym staff must not select another enrollment gym");
    return route.fulfill({ json: { config: configFor(gyms[0]), gyms: [], systemUser: currentUser } });
  });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(origin + "/staff/members/enroll?kind=new");
  await page.getByRole("heading", { name: "Choose an enrollment gym" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Join Birkirkara" }).count(), 0,
    "Super Admin must not be automatically assigned a gym");
  assert.equal(await returnLink().getAttribute("href"), "/staff");
  await page.getByLabel("Enrollment gym").selectOption("gym-two");
  await page.getByRole("heading", { name: "Join Mosta" }).waitFor();
  assert.equal(lastSelectedGym, "gym-two");
  assert.equal(await returnLink().count(), 1, "Return button stays visible at registration step 2");
  await page.screenshot({ path: artifacts + "/super-admin-selected-gym.png", fullPage: true });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Change enrollment gym" }).click();
  await page.getByRole("heading", { name: "Choose an enrollment gym" }).waitFor();
  await page.getByLabel("Enrollment gym").selectOption("gym-one");
  await page.getByRole("heading", { name: "Join Birkirkara" }).waitFor();
  assert.equal(lastSelectedGym, "gym-one", "Changing the selection reloads the intended gym");

  await page.getByRole("button", { name: "Regular", exact: true }).click();
  await page.locator("label").filter({ hasText: "Membership duration" }).locator("select").selectOption("1_month");
  await page.getByLabel("I understand these requirements and I am ready to continue.", { exact: true }).check();
  await page.getByLabel("First name", { exact: true }).fill("Browser");
  await page.getByLabel("Last name", { exact: true }).fill("Applicant");
  await page.getByLabel("ID card / passport number", { exact: true }).fill("TEST123M");
  await page.getByLabel("Date of birth", { exact: true }).fill("1994-02-04");
  await page.getByLabel("Address", { exact: true }).fill("1 Browser Street");
  await page.getByLabel("Town / locality", { exact: true }).fill("Birkirkara");
  await page.getByLabel("Mobile / phone", { exact: true }).fill("79000000");
  await page.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await page.getByLabel("Next of kin / emergency contact", { exact: true }).fill("Browser Kin 79000001");
  await page.getByLabel("I have read and agree to the BGM Gym Rules.", { exact: true }).check();
  await page.getByLabel("I have read and agree to the Privacy and data processing notice.", { exact: true }).check();
  await page.getByLabel("I have read and agree to the Health declaration.", { exact: true }).check();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await page.getByText("Browser test intentionally stops before saving.", { exact: true }).first().waitFor();
  assert.equal(submittedGym, "gym-one", "Submitted application must use the explicitly chosen gym");

  currentUser = staff;
  await page.reload();
  await page.getByRole("heading", { name: "Join Birkirkara" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Choose an enrollment gym" }).count(), 0,
    "Assigned gym staff must skip the Super Admin selector");
  assert.equal(await returnLink().getAttribute("href"), "/staff");
  await returnLink().click();
  await page.waitForURL(origin + "/staff");
  assert.equal(await returnLink().count(), 0, "Portal home must not display a return link to itself");
  await page.goto(origin + "/staff/admin");
  assert.equal(await returnLink().getAttribute("href"), "/staff", "Shared layout covers admin subpages");
  await page.goto(origin + "/staff/membership-settings");
  assert.equal(await returnLink().getAttribute("href"), "/staff", "Shared layout covers membership settings");
  await page.goto(origin + "/staff/reception");
  assert.equal(await returnLink().getAttribute("href"), "/staff", "Shared layout covers reception");
  assert.deepEqual(pageErrors, [], "New enrollment flow and shared navigation have no client errors");
  console.log("PASS Super Admin selects gym, staff gym remains assigned, return link spans staff subpages");
} catch (error) {
  if (page) await page.screenshot({ path: artifacts + "/failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
