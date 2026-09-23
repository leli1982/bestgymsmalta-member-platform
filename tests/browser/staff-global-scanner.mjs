import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3110";
const artifacts = "test-artifacts/staff-global-scanner";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3110", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] }
);
let output = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => {
    output = (output + data).slice(-4000);
  });
}

const user = {
  id: "global-scanner-browser-staff",
  gymId: "bgm-birkirkara",
  displayName: "Birkirkara Browser Reception",
  isSuperAdmin: false,
  permissions: [
    "barcode.scan", "members.view", "members.create", "members.renew",
    "orders.sundries.submit", "orders.bar.submit",
  ],
};

let browser;
try {
  await mkdir(artifacts, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin + "/staff/sundries")).ok) break;
    } catch {}
    if (attempt > 120 || server.exitCode !== null) {
      throw new Error("Next.js did not start: " + output);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await context.route("**/api/system/auth", (route) =>
    route.fulfill({ json: { authenticated: true, user } })
  );
  await context.route("**/api/system/orders?*", (route) =>
    route.fulfill({ json: { orders: [] } })
  );
  let scans = 0;
  await context.route("**/api/system/barcode/scan", (route) => {
    assert.equal(route.request().method(), "POST");
    const code = route.request().postDataJSON().membershipNumber;
    assert.ok(["BGM0000123", "BGM0000999", "BGM0000777"].includes(code));
    scans++;
    const granted = code !== "BGM0000999";
    return route.fulfill({
      json: {
        result: granted ? "granted" : "expired",
        granted,
        scannedBarcode: code,
        member: {
          id: "member-global-scanner",
          fullName: granted ? "Active Member" : "Expired Member",
          memberNumber: code,
          status: granted ? "active" : "expired",
          membershipExpiry: granted ? "2027-12-31" : "2025-01-01",
          photoRequired: false,
          photoUrl: null,
        },
      },
    });
  });

  async function sendConfiguredScan(code) {
    await page.keyboard.press("F9");
    await page.keyboard.type(code, { delay: 4 });
    await page.keyboard.press("Enter");
  }

  await page.goto(origin + "/staff/sundries");
  const name = page.getByPlaceholder("e.g. Maria Borg");
  await name.waitFor({ state: "visible", timeout: 15000 });
  await name.fill("Maria Borg");
  await name.focus();
  await sendConfiguredScan("BGM0000123");

  const access = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await access.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await name.inputValue(), "Maria Borg", "Scanner input must not corrupt the focused Staff form");
  await access.getByText("Active Member", { exact: true }).waitFor();
  await page.screenshot({ path: artifacts + "/sundries-granted.png" });
  await access.getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  assert.equal(await name.inputValue(), "Maria Borg");
  assert.equal(await name.evaluate((input) => document.activeElement === input), true,
    "Staff input focus must be restored after the access overlay");

  const item = page.getByRole("spinbutton", { name: "Toilet paper quantity" });
  await item.fill("4");
  await item.focus();
  await sendConfiguredScan("BGM0000999");
  const denied = page.getByRole("dialog", { name: "MEMBERSHIP EXPIRED" });
  await denied.waitFor({ state: "visible", timeout: 15000 });
  await denied.getByText("DO NOT ALLOW ACCESS until verified by reception.").waitFor();
  assert.equal(await item.inputValue(), "4");
  await page.screenshot({ path: artifacts + "/sundries-declined.png" });
  await denied.getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  assert.equal(await item.inputValue(), "4");
  assert.equal(await name.inputValue(), "Maria Borg");

  await context.route("**/api/system/bar/catalog", (route) =>
    route.fulfill({ json: { items: [
      { id: "bar-water", name: "Water 500 ml", priceCents: 150,
        isOther: false, active: true, sortOrder: 0, updatedAt: "2026-09-21T00:00:00Z" },
    ] } })
  );
  await context.route("**/api/system/bar/today?**", (route) =>
    route.fulfill({ json: {
      gymId: user.gymId, businessDate: "2026-09-21",
      totalCents: 0, submittedCount: 0, unpricedCount: 0,
    } })
  );
  await page.goto(origin + "/staff/bar");
  const barName = page.getByRole("textbox", { name: "Bar Staff name" });
  await barName.waitFor({ state: "visible", timeout: 15000 });
  await barName.fill("Bar Staff");
  await barName.focus();
  await sendConfiguredScan("BGM0000777");
  await page.getByRole("dialog", { name: "ACCESS GRANTED" }).waitFor({ state: "visible" });
  assert.equal(await barName.inputValue(), "Bar Staff");
  await page.screenshot({ path: artifacts + "/bar-granted.png" });
  await page.getByRole("dialog", { name: "ACCESS GRANTED" })
    .getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  // Ordinary unprogrammed keyboard-wedge: no F9 prefix, scanner sends code + Enter.
  // The Staff name must remain byte-for-byte unchanged, including React state.
  await barName.fill("Bar Staff");
  await barName.focus();
  await page.keyboard.type("BGM0000777", { delay: 4 });
  await page.keyboard.press("Enter");
  const unprogrammed = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await unprogrammed.waitFor({ state: "visible" });
  assert.equal(await barName.inputValue(), "Bar Staff",
    "Unprogrammed scanner must not append a barcode to Staff name");
  await unprogrammed.getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  assert.equal(await barName.inputValue(), "Bar Staff",
    "Controlled Staff name must still be intact after closing result");
  assert.equal(await barName.evaluate(input => document.activeElement === input), true,
    "Scanner must restore focus to the Staff name field");

  // A person typing normally without Enter must never cause a scan. Fast typing
  // held in the scanner candidate buffer must be replayed into the form.
  await barName.fill("");
  await barName.focus();
  await page.keyboard.type("Leli Apap", { delay: 50 });
  await page.waitForTimeout(220);
  assert.equal(await barName.inputValue(), "Leli Apap");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);

  // Reliable one-click fallback for numeric/atypical fields where auto-recognition
  // is intentionally disabled to protect quantities and price inputs.
  await barName.fill("Bar Staff");
  const barCash = page.getByRole("spinbutton", { name: /total cash found/i });
  if (await barCash.count()) {
    await barCash.fill("15");
    await barCash.focus();
    await page.getByRole("button", { name: "Scan card", exact: true }).click();
    const manualDialog = page.getByRole("dialog", { name: "Scan card" });
    await manualDialog.getByPlaceholder("Scan or enter card barcode").fill("BGM0000777");
    await manualDialog.getByRole("button", { name: "Verify card" }).click();
    await page.getByRole("dialog", { name: "ACCESS GRANTED" }).waitFor();
    assert.equal(await barCash.inputValue(), "15", "Manual scan must not alter cash amount");
    await page.getByRole("dialog", { name: "ACCESS GRANTED" })
      .getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  }
  assert.equal(scans, (await barCash.count()) ? 5 : 4, "Every submitted scan must be verified exactly once");
  assert.deepEqual(pageErrors, [], "Global scanner must not trigger browser errors");
  console.log("PASS global scanner verifies active and expired cards across Sundries and Bar without losing Staff form input");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
