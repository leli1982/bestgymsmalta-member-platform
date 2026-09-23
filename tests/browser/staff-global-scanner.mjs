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

  // Real-world TEST card formats: six-character letter-and-digits and eight digits.
  // Both unprogrammed scans must be recognised without touching the Staff form.
  for (const barcode of ["X06956", "59060154"]) {
    await barName.fill("Bar Staff");
    await barName.focus();
    await page.keyboard.type(barcode, { delay: 4 });
    await page.keyboard.press("Enter");
    const cardResult = page.getByRole("dialog", { name: "ACCESS GRANTED" });
    await cardResult.waitFor({ state: "visible" });
    assert.equal(await barName.inputValue(), "Bar Staff",
      "Scanner appended a " + barcode.length + "-character card to Staff name");
    await cardResult.getByText(barcode, { exact: true }).first().waitFor();
    await cardResult.getByRole("button", { name: "Close / Return to Staff Task" }).click();
    assert.equal(await barName.inputValue(), "Bar Staff");
  }

  // Six ordinary letters, even if entered quickly and followed by Enter,
  // must remain in the form rather than being mistaken for the short card format.
  await barName.fill("");
  await barName.focus();
  await page.keyboard.type("Manuel", { delay: 4 });
  await page.keyboard.press("Enter");
  assert.equal(await barName.inputValue(), "Manuel");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);

  // A person typing normally without Enter must never cause a scan. Fast typing
  // held in the scanner candidate buffer must be replayed into the form.
  await barName.fill("");
  await barName.focus();
  await page.keyboard.type("Leli Apap", { delay: 50 });
  await page.waitForTimeout(220);
  assert.equal(await barName.inputValue(), "Leli Apap");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);

  // Card assignment and renewal must take precedence over the global
  // entrance reader. A dedicated focused card field receives the scanner
  // keyboard input and Enter; no access scan should be submitted.
  const assignedBefore = scans;
  const assignmentInput = await page.evaluate(() => {
    const input = document.createElement("input");
    input.setAttribute("data-bgm-scan-input", "true");
    input.setAttribute("aria-label", "Membership assignment scanner input");
    input.placeholder = "Scanner input";
    document.body.appendChild(input);
    input.focus();
    return true;
  });
  assert.equal(assignmentInput, true);
  const focusedAssignment = page.getByRole("textbox", { name: "Membership assignment scanner input" });
  await page.keyboard.type("X06956", { delay: 4 });
  await page.keyboard.press("Enter");
  assert.equal(await focusedAssignment.inputValue(), "X06956",
    "The global reader must let the selected membership scanner input receive the entire card");
  assert.equal(scans, assignedBefore,
    "A dedicated enrollment scanner input must NOT cause an entrance-access check");
  assert.equal(await page.getByRole("dialog", { name: "ACCESS GRANTED" }).count(), 0);
  await focusedAssignment.evaluate((input) => input.remove());

  // Outside a dedicated card field, the same physical code should again
  // trigger global entrance verification as expected.
  await barName.focus();
  await page.keyboard.type("X06956", { delay: 4 });
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "ACCESS GRANTED" }).waitFor();
  await page.getByRole("dialog", { name: "ACCESS GRANTED" })
    .getByRole("button", { name: "Close / Return to Staff Task" }).click();
  assert.equal(await barName.inputValue(), "Bar Staff",
    "Focused Staff fields must still be protected after a card assignment");

  // Regression: barcode scans when a number/quantity input is focused must
  // NEVER modify the quantity, its React state or the calculated Bar total.
  const barQuantity = page.getByRole("spinbutton", { name: "Water 500 ml quantity" });
  await barQuantity.fill("4");
  await page.waitForTimeout(200);
  const totalBeforeNumericScans = await page.getByLabel("Total Sales calculated").textContent();
  for (const barcode of ["X06956", "59060154"]) {
    await barQuantity.focus();
    await page.keyboard.type(barcode, { delay: 4 });
    await page.keyboard.press("Enter");
    const numericResult = page.getByRole("dialog", { name: "ACCESS GRANTED" });
    await numericResult.waitFor({ state: "visible" });
    assert.equal(await barQuantity.inputValue(), "4",
      "Barcode " + barcode + " must not enter focused quantity input");
    await numericResult.getByRole("button", { name: "Close / Return to Staff Task" }).click();
    assert.equal(await barQuantity.inputValue(), "4",
      "Bar quantity must still be four after closing scanned member result");
    assert.equal(await page.getByLabel("Total Sales calculated").textContent(),
      totalBeforeNumericScans, "Scan must not change the Bar total or quantity state");
  }

  // Ordinary human quantity typing must be replayed and still update React
  // after the short buffered scanner-detection interval.
  await barQuantity.fill("");
  await barQuantity.focus();
  await page.keyboard.type("2", { delay: 40 });
  await page.waitForTimeout(260);
  assert.equal(await barQuantity.inputValue(), "2",
    "A single normally typed quantity digit must be retained");
  await barQuantity.fill("4");
  await page.waitForTimeout(100);
  assert.equal(await page.getByLabel("Total Sales calculated").textContent(),
    totalBeforeNumericScans, "Quantity must still be editable after scanning");

  // Reliable one-click fallback for unusual fields or scanner timing.

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
  assert.equal(scans, (await barCash.count()) ? 10 : 9, "Every submitted scan must be verified exactly once");
  assert.deepEqual(pageErrors, [], "Global scanner must not trigger browser errors");
  console.log("PASS global scanner verifies active and expired cards across Sundries and Bar without losing Staff form input");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
