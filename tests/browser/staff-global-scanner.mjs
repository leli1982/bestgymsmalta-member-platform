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
    "orders.sundries.submit", "orders.bar.submit", "end_of_day.submit",
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
  await context.route("**/api/gyms", (route) =>
    route.fulfill({ json: { gyms: [
      { id: user.gymId, name: "Birkirkara", status: "active" },
    ] } })
  );

  let scans = 0;
  await context.route("**/api/system/barcode/scan", (route) => {
    assert.equal(route.request().method(), "POST");
    const code = route.request().postDataJSON().membershipNumber;
    assert.ok(["BGM0000123", "BGM0000999", "BGM0000777", "X06956", "59060154"].includes(code));
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
          enrollmentGymName: "Birkirkara",
          legacyGym: "Mosta",
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

  // Keep the original live scanner checks on Sundries intact.
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
  await access.getByText("Original gym: Mosta", { exact: true }).waitFor();
  const grantedPhotoBox = await access.getByTestId("scan-member-photo").boundingBox();
  assert.ok(grantedPhotoBox && grantedPhotoBox.width >= 300,
    "Granted scan must show a large identity photo panel");
  await page.screenshot({ path: artifacts + "/sundries-granted.png" });
  await access.waitFor({ state: "hidden", timeout: 6000 });
  assert.equal(await name.inputValue(), "Maria Borg");
  assert.equal(await name.evaluate((input) => document.activeElement === input), true,
    "Normal granted access must auto-close and restore Staff input focus");

  const sundriesQuantity = page.getByRole("spinbutton", { name: "Toilet paper quantity" });
  await sundriesQuantity.fill("4");
  await sundriesQuantity.focus();
  await sendConfiguredScan("BGM0000999");
  const denied = page.getByRole("dialog", { name: "MEMBERSHIP EXPIRED" });
  await denied.waitFor({ state: "visible", timeout: 15000 });
  await denied.getByText("DO NOT ALLOW ACCESS until verified by reception.").waitFor();
  await denied.getByText("Original gym: Mosta", { exact: true }).waitFor();
  const deniedPhotoBox = await denied.getByTestId("scan-member-photo").boundingBox();
  assert.ok(deniedPhotoBox && deniedPhotoBox.width >= 300,
    "Declined scan must keep the large identity photo panel");
  assert.equal(await sundriesQuantity.inputValue(), "4");
  await page.screenshot({ path: artifacts + "/sundries-declined.png" });
  await page.waitForTimeout(4000);
  assert.equal(await denied.isVisible(), true,
    "Expired/declined warnings must remain open until Staff dismiss them");
  await denied.getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  assert.equal(await sundriesQuantity.inputValue(), "4");
  assert.equal(await name.inputValue(), "Maria Borg");

  // The TEST Bar page is now the live daily sheet. There is intentionally no
  // legacy "Bar Staff name" / manual-submit field, so protect the controls that
  // actually exist: product search and quantities.
  await context.route("**/api/system/bar/catalog", (route) =>
    route.fulfill({ json: { items: [
      { id: "bar-water", name: "Water 500 ml", priceCents: 150,
        isOther: false, active: true, sortOrder: 0, updatedAt: "2026-09-21T00:00:00Z" },
    ] } })
  );
  await context.route("**/api/system/bar/today**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: {
        gymId: user.gymId,
        businessDate: "2026-09-21",
        orderId: null,
        totalCents: 0,
        locked: false,
        lockedAt: null,
        updatedAt: null,
        items: [],
      } });
    }
    assert.equal(route.request().method(), "PUT");
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto(origin + "/staff/bar");
  const productSearch = page.getByRole("textbox", { name: "Find Bar product" });
  await productSearch.waitFor({ state: "visible", timeout: 15000 });
  await productSearch.fill("Water");
  await productSearch.focus();
  await sendConfiguredScan("BGM0000777");
  let granted = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await granted.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await productSearch.inputValue(), "Water",
    "Configured scanner must not corrupt Bar product search");
  await page.screenshot({ path: artifacts + "/bar-granted.png" });
  await granted.getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();

  // Ordinary unprogrammed keyboard-wedge: scanner sends code + Enter.
  await productSearch.fill("Water");
  await productSearch.focus();
  await page.keyboard.type("BGM0000777", { delay: 4 });
  await page.keyboard.press("Enter");
  granted = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await granted.waitFor({ state: "visible" });
  assert.equal(await productSearch.inputValue(), "Water",
    "Unprogrammed scanner must not append a barcode to Bar product search");
  await granted.getByRole("button", { name: /Close \/ Return to Staff Task/ }).click();
  assert.equal(await productSearch.inputValue(), "Water");
  assert.equal(await productSearch.evaluate((input) => document.activeElement === input), true,
    "Scanner must restore focus to the Bar field that Staff were using");

  // Real-world TEST card formats must be recognised without touching Staff UI.
  for (const barcode of ["X06956", "59060154"]) {
    await productSearch.fill("Water");
    await productSearch.focus();
    await page.keyboard.type(barcode, { delay: 4 });
    await page.keyboard.press("Enter");
    const cardResult = page.getByRole("dialog", { name: "ACCESS GRANTED" });
    await cardResult.waitFor({ state: "visible" });
    assert.equal(await productSearch.inputValue(), "Water",
      "Scanner appended a " + barcode.length + "-character card to Bar product search");
    await cardResult.getByText(barcode, { exact: true }).first().waitFor();
    await cardResult.getByRole("button", { name: "Close / Return to Staff Task" }).click();
  }

  // Ordinary fast typing is still ordinary form input, not a short-card scan.
  await productSearch.fill("");
  await productSearch.focus();
  await page.keyboard.type("Manuel", { delay: 4 });
  await page.keyboard.press("Enter");
  assert.equal(await productSearch.inputValue(), "Manuel");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);

  await productSearch.fill("");
  await productSearch.focus();
  await page.keyboard.type("Water", { delay: 50 });
  await page.waitForTimeout(220);
  assert.equal(await productSearch.inputValue(), "Water");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);

  // Dedicated assignment/renewal scanner fields always take precedence over
  // the global entrance reader.
  const assignedBefore = scans;
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.setAttribute("data-bgm-scan-input", "true");
    input.setAttribute("aria-label", "Membership assignment scanner input");
    input.placeholder = "Scanner input";
    document.body.appendChild(input);
    input.focus();
  });
  const focusedAssignment = page.getByRole("textbox", { name: "Membership assignment scanner input" });
  await page.keyboard.type("X06956", { delay: 4 });
  await page.keyboard.press("Enter");
  assert.equal(await focusedAssignment.inputValue(), "X06956",
    "Global reader must let a dedicated membership scanner input receive the entire card");
  assert.equal(scans, assignedBefore,
    "Dedicated enrollment scanner input must NOT cause an entrance-access check");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);
  await focusedAssignment.evaluate((input) => input.remove());

  // Outside the dedicated field, the same card resumes entrance verification.
  await productSearch.fill("Water");
  await productSearch.focus();
  await page.keyboard.type("X06956", { delay: 4 });
  await page.keyboard.press("Enter");
  granted = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await granted.waitFor({ state: "visible" });
  await granted.getByRole("button", { name: "Close / Return to Staff Task" }).click();
  assert.equal(await productSearch.inputValue(), "Water");

  // Barcode scans with a number/quantity input focused must never alter the
  // quantity, React state, or calculated live Bar total.
  await productSearch.fill("Water");
  const barQuantity = page.getByRole("spinbutton", { name: "Water 500 ml quantity" });
  await barQuantity.fill("4");
  await page.waitForTimeout(450);
  const totalBeforeNumericScans = await page.getByLabel("Bar total for today").textContent();
  for (const barcode of ["X06956", "59060154"]) {
    await barQuantity.focus();
    await page.keyboard.type(barcode, { delay: 4 });
    await page.keyboard.press("Enter");
    const numericResult = page.getByRole("dialog", { name: "ACCESS GRANTED" });
    await numericResult.waitFor({ state: "visible" });
    assert.equal(await barQuantity.inputValue(), "4",
      "Barcode " + barcode + " must not enter focused Bar quantity input");
    await numericResult.getByRole("button", { name: "Close / Return to Staff Task" }).click();
    assert.equal(await barQuantity.inputValue(), "4");
    assert.equal(await page.getByLabel("Bar total for today").textContent(), totalBeforeNumericScans,
      "Scan must not change the live Bar total or quantity state");
  }

  // Human quantity typing must still work after the scanner checks.
  await barQuantity.fill("");
  await barQuantity.focus();
  await page.keyboard.type("2", { delay: 40 });
  await page.waitForTimeout(260);
  assert.equal(await barQuantity.inputValue(), "2",
    "A normally typed quantity digit must be retained");
  await barQuantity.fill("4");
  await page.waitForTimeout(100);
  assert.equal(await page.getByLabel("Bar total for today").textContent(), totalBeforeNumericScans,
    "Bar quantity must remain editable after scanning");

  assert.equal(scans, 9, "Every submitted scan must be verified exactly once");
  assert.deepEqual(pageErrors, [], "Global scanner must not trigger browser errors");
  console.log("PASS global scanner preserves Sundries and live Bar controls while verifying cards");
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill("SIGTERM");
}
