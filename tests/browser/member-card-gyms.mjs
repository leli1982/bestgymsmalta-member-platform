import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3100";
const artifacts = "test-artifacts/member-ui";
const member = {
  id: "browser-test-member", username: "browser-member", fullName: "Browser Test Member",
  memberNumber: "BGM0000123", email: "browser@example.test", status: "active",
  membershipExpiry: "9999-12-31",
};
const activeAccess = {
  state: "active",
  daysUntilExpiry: 9999,
  graceDaysRemaining: 0,
  reminderDue: false,
};
const readyCard = {
  member,
  cardLinked: true,
  cardBarcode: "NEW001aB",
  physicalCardBarcode: "NEW001aB",
  source: "physical_card",
};
const gym = {
  id: "bgm-birkirkara", name: "BGM Birkirkara", status: "active", city: "Birkirkara",
  address: "Test gym address, Birkirkara", openingHours: "Monday – Friday: 06:00 – 22:00",
  coverImage: "/visuals/gyms/birkirkara.jpg", facilities: ["Weights", "Showers"],
  classes: ["Strength"], featuredEquipment: ["Squat racks"],
  virtualTourUrl: "https://my.matterport.com/show/?m=yo8dbfqbqHQ",
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { serverOutput = (serverOutput + data).slice(-6000); });
let browser;
let page;
const pageErrors = [];

async function visible(locator) { await locator.waitFor({ state: "visible", timeout: 15000 }); }
async function noText(text) { assert.equal(await page.getByText(text, { exact: true }).count(), 0); }
async function lightLayout() {
  assert.equal(await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(246, 246, 246)");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "page must fit the mobile viewport");
}
async function newPage(cached = null, width = 390, mockActiveSession = true) {
  if (page) await page.context().close();
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  await context.addInitScript(({ member, cached }) => {
    sessionStorage.setItem("bgmSplashShown", "true");
    localStorage.setItem("bgmOnboardingComplete:" + member.id, "true");
    if (cached && !sessionStorage.getItem("browserFixtureSeeded")) {
      localStorage.setItem("bgmMemberSession", JSON.stringify(cached));
      sessionStorage.setItem("browserFixtureSeeded", "true");
    }
  }, { member, cached });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  if (mockActiveSession) {
    await page.route("**/api/member/auth/session", (route) => route.fulfill({ json: { member, access: activeAccess } }));
  }
  await page.route("**/api/gyms", (route) => route.fulfill({ json: { gyms: [gym] } }));
  await page.route("https://my.matterport.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Test tour</p>" }));
}
try {
  await mkdir(artifacts, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin + "/card")).ok) break; } catch {}
    if (attempt > 100 || server.exitCode !== null) throw new Error("Next.js did not start: " + serverOutput);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });

  // Reproduce the reported stale-profile state, then use the real login form.
  await newPage(member, 390, false);
  let signedIn = false;
  await page.route("**/api/member/card", (route) => route.fulfill(signedIn
    ? { json: readyCard } : { status: 401, json: { error: "Member session required." } }));
  await page.route("**/api/member/auth/session", (route) => route.fulfill(signedIn
    ? { json: { member, access: activeAccess } } : { status: 401, json: { error: "Please sign in." } }));
  await page.route("**/api/member/auth/login", (route) => {
    assert.equal(route.request().method(), "POST");
    assert.deepEqual(route.request().postDataJSON(), { login: "browser-member", password: "test-password" });
    signedIn = true;
    return route.fulfill({ json: { member, access: activeAccess } });
  });
  await page.goto(origin + "/card");
  await visible(page.getByRole("heading", { name: "Sign in to show your card" }));
  await noText("CARD NOT LINKED");
  assert.equal(await page.evaluate(() => localStorage.getItem("bgmMemberSession")), null);
  await lightLayout();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await visible(page.getByPlaceholder("Username or BGM1000"));
  await page.getByPlaceholder("Username or BGM1000").fill("browser-member");
  await page.getByPlaceholder("Your password").fill("test-password");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(origin + "/card");
  await visible(page.locator('svg[aria-label="Member barcode NEW001aB"]'));
  assert.equal(await page.locator('svg[aria-label="Member barcode BGM0000123"]').count(), 0);
  await visible(page.getByText("BGM0000123", { exact: true }).first());
  await page.screenshot({ path: artifacts + "/card-390.png", fullPage: true });
  console.log("PASS stale saved profile → sign in → return to current card");

  // A server session works with empty local storage; old in-flight data cannot undo logout.
  await newPage();
  let delayedRoute;
  let delayNext = false;
  await page.route("**/api/member/card", async (route) => {
    if (delayNext) { delayedRoute = route; return; }
    await route.fulfill({ json: readyCard });
  });
  await page.goto(origin + "/card");
  await visible(page.locator('svg[aria-label="Member barcode NEW001aB"]'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("bgmMemberSession")).id), member.id);
  delayNext = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  for (let n = 0; !delayedRoute && n < 100; n++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(delayedRoute, "focus should request the current card");
  await page.evaluate(() => {
    localStorage.removeItem("bgmMemberSession");
    window.dispatchEvent(new CustomEvent("bgmMemberChanged", { detail: { signedOut: true } }));
  });
  await visible(page.getByRole("heading", { name: "Sign in to show your card" }));
  await delayedRoute.fulfill({ json: readyCard });
  await page.waitForLoadState("networkidle");
  await visible(page.getByRole("heading", { name: "Sign in to show your card" }));
  assert.equal(await page.locator('svg[aria-label="Member barcode NEW001aB"]').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("bgmMemberSession")), null);
  console.log("PASS cookie-backed profile restoration and stale response after logout");

  await newPage(null, 320);
  let requestCount = 0;
  await page.route("**/api/member/card", (route) => route.fulfill(++requestCount === 1
    ? { status: 500, json: { error: "Temporary failure" } }
    : { json: { ...readyCard, cardLinked: false, cardBarcode: null, physicalCardBarcode: null, source: null } }));
  await page.goto(origin + "/card");
  await visible(page.getByRole("heading", { name: "Card temporarily unavailable" }));
  await noText("CARD NOT LINKED");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await visible(page.getByText("Card not assigned. Staff can still find you using your BGM membership number."));
  assert.equal(await page.locator('svg[aria-label^="Member barcode"]').count(), 0);
  await visible(page.getByText("BGM0000123", { exact: true }).first());
  await page.getByRole("button", { name: "Show membership details" }).click();
  await visible(page.getByText("Current card number", { exact: true }));
  await visible(page.getByText("Not assigned", { exact: true }));
  await lightLayout();
  await page.screenshot({ path: artifacts + "/card-unlinked-320.png", fullPage: true });
  console.log("PASS request failure, retry and unassigned card without scannable barcode at 320px");

  // Google Wallet: active full card uses the official button, submits once, and navigates to Google's save URL.
  await newPage(null, 390);
  let walletPostCount = 0;
  await page.route("**/api/member/card", (route) => route.fulfill({ json: readyCard }));
  await page.route("**/api/member/google-wallet", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: {
        available: true, eligible: true, reason: null, provisioned: false, syncStatus: null, lastSyncedAt: null,
      } });
    }
    assert.equal(route.request().method(), "POST");
    walletPostCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return route.fulfill({ json: { saveUrl: "https://pay.google.com/gp/v/save/browser-test-wallet" } });
  });
  await page.route("https://pay.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Wallet save intercepted</p>" }));
  await page.goto(origin + "/card");
  await visible(page.locator('svg[aria-label="Member barcode NEW001aB"]'));
  const walletButton = page.getByRole("button", { name: "Add to Google Wallet" });
  await visible(walletButton);
  assert.equal(await walletButton.locator('img[src="/google-wallet/add-to-google-wallet.svg"]').count(), 1);
  await lightLayout();
  await walletButton.evaluate((element) => { element.click(); element.click(); });
  await page.waitForURL("https://pay.google.com/gp/v/save/browser-test-wallet");
  assert.equal(walletPostCount, 1, "duplicate Wallet taps must issue exactly one POST");
  console.log("PASS eligible Google Wallet button, duplicate-click guard and save navigation");

  // Feature/config unavailable is hidden rather than exposing a broken action.
  await newPage(null, 390);
  await page.route("**/api/member/card", (route) => route.fulfill({ json: readyCard }));
  await page.route("**/api/member/google-wallet", (route) => route.fulfill({ json: {
    available: false, eligible: false, reason: "unavailable", provisioned: false, syncStatus: null, lastSyncedAt: null,
  } }));
  await page.goto(origin + "/card");
  await visible(page.locator('svg[aria-label="Member barcode NEW001aB"]'));
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("button", { name: "Add to Google Wallet" }).count(), 0);
  await lightLayout();
  console.log("PASS unavailable Google Wallet action stays hidden");

  // Canonical Wallet status supplies ineligibility; the client does not infer it from card dates/barcodes.
  await newPage(null, 320);
  await page.route("**/api/member/card", (route) => route.fulfill({ json: {
    ...readyCard, cardLinked: false, cardBarcode: null, physicalCardBarcode: null, source: null,
  } }));
  await page.route("**/api/member/google-wallet", (route) => route.fulfill({ json: {
    available: true, eligible: false, reason: "card_missing", provisioned: false, syncStatus: null, lastSyncedAt: null,
  } }));
  await page.goto(origin + "/card");
  await visible(page.getByText("Ask staff to assign an active card before adding it to Google Wallet."));
  assert.equal(await page.getByRole("button", { name: "Add to Google Wallet" }).count(), 0);
  assert.equal(await page.locator('svg[aria-label^="Member barcode"]').count(), 0);
  await visible(page.getByText("BGM0000123", { exact: true }).first());
  await lightLayout();
  console.log("PASS cardless Wallet ineligibility and 320px layout");

  await newPage(null, 390);
  await page.route("**/api/member/card", (route) => route.fulfill({ json: readyCard }));
  await page.route("**/api/member/google-wallet", (route) => route.fulfill({ json: {
    available: true, eligible: false, reason: "expired", provisioned: true, syncStatus: "synced", lastSyncedAt: "2026-10-09T00:00:00Z",
  } }));
  await page.goto(origin + "/card");
  await visible(page.getByText("Renew your membership before adding it to Google Wallet."));
  assert.equal(await page.getByRole("button", { name: "Add to Google Wallet" }).count(), 0);
  assert.equal(await page.locator('svg[aria-label="Member barcode NEW001aB"]').count(), 1);
  assert.equal(await page.locator('svg[aria-label="Member barcode BGM0000123"]').count(), 0);
  await lightLayout();
  console.log("PASS expired Wallet ineligibility preserves physical-card/BGM-number separation");

  // Verify the real client-side gym rendering and navigation at narrow widths.
  for (const width of [320, 390]) {
    await newPage(null, width);
    await page.goto(origin + "/gyms");
    await visible(page.getByRole("heading", { name: gym.name, exact: true }));
    await lightLayout();
    assert.equal(await page.locator("article").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
    await page.getByRole("searchbox", { name: "Search gym or location" }).fill("missing-location");
    await visible(page.getByRole("heading", { name: "No gyms found" }));
    await page.getByRole("searchbox", { name: "Search gym or location" }).fill("Birkirkara");
    await page.getByRole("link", { name: "View gym", exact: true }).click();
    await visible(page.getByRole("heading", { name: gym.name, exact: true }));
    await lightLayout();
    await page.screenshot({ path: artifacts + "/gym-detail-" + width + ".png", fullPage: true });
    await page.getByRole("link", { name: "Start virtual tour" }).click();
    await visible(page.getByRole("heading", { name: "Explore " + gym.name }));
    await lightLayout();
    assert.equal(await page.locator("iframe").getAttribute("src"), gym.virtualTourUrl);
    console.log("PASS light gym list, detail and tour navigation at " + width + "px");
  }
  assert.deepEqual(pageErrors, [], "member pages must not raise browser errors");
} catch (error) {
  if (page) await page.screenshot({ path: artifacts + "/failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
