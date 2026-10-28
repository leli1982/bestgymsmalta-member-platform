import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3115";
const artifactDir = "test-artifacts/bar-sales";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3115", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => { logs = (logs + data).slice(-4000); });
}

let browser;
try {
  await mkdir(artifactDir, { recursive: true });
  for (let n = 0; ; n += 1) {
    try { if ((await fetch(origin + "/staff/bar")).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next.js startup failed: " + logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1130, height: 850 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const gym = { id: "bgm-birkirkara", name: "Birkirkara Fitness", status: "active" };
  const staff = {
    gymId: gym.id,
    displayName: "Birkirkara Staff",
    isSuperAdmin: false,
    permissions: ["barcode.scan", "orders.bar.submit", "end_of_day.submit"],
  };
  const products = [
    { id: "water", name: "Water 500ml", priceCents: 150, isOther: false, active: true, sortOrder: 0, updatedAt: "2026-10-28" },
    { id: "protein", name: "Protein bar", priceCents: 225, isOther: false, active: true, sortOrder: 1, updatedAt: "2026-10-28" },
    { id: "others", name: "Others", priceCents: null, isOther: true, active: true, sortOrder: 999, updatedAt: "2026-10-28" },
  ];

  let serverLocked = false;
  let savedEntries = [{
    catalogItemId: "water",
    itemName: "Water 500ml",
    quantity: 2,
    unitPriceCents: 150,
    lineTotalCents: 300,
  }];
  let putCount = 0;

  await context.route("**/api/system/auth", (route) => route.fulfill({ json: { authenticated: true, user: staff } }));
  await context.route("**/api/gyms", (route) => route.fulfill({ json: { gyms: [gym] } }));
  await context.route("**/api/system/bar/catalog", (route) => route.fulfill({ json: { items: products } }));
  await context.route("**/api/system/bar/today**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ json: {
        gymId: gym.id,
        businessDate: "2026-10-28",
        orderId: "daily-sheet",
        totalCents: savedEntries.reduce((sum, row) => sum + row.lineTotalCents, 0),
        locked: serverLocked,
        lockedAt: serverLocked ? "2026-10-28T19:00:00Z" : null,
        updatedAt: "2026-10-28T18:00:00Z",
        items: savedEntries,
      } });
    }
    assert.equal(method, "PUT");
    putCount += 1;
    const body = route.request().postDataJSON();
    assert.equal(body.gymId, undefined, "Gym Staff daily Bar save must use the logged-in gym");
    assert.ok(Array.isArray(body.barEntries));
    if (serverLocked) {
      return route.fulfill({ status: 409, json: { error: "End of Day has already been submitted for this gym.", locked: true } });
    }
    savedEntries = body.barEntries.map((entry) => {
      const product = products.find((item) => item.id === entry.catalogItemId);
      const unitPriceCents = product?.isOther ? entry.otherPriceCents : product?.priceCents;
      const itemName = product?.isOther ? entry.otherName : product?.name;
      return {
        catalogItemId: entry.catalogItemId,
        itemName,
        quantity: entry.quantity,
        unitPriceCents,
        lineTotalCents: unitPriceCents * entry.quantity,
      };
    });
    return route.fulfill({ json: {
      ok: true,
      sheet: {
        gymId: gym.id,
        businessDate: "2026-10-28",
        orderId: "daily-sheet",
        totalCents: savedEntries.reduce((sum, row) => sum + row.lineTotalCents, 0),
        locked: false,
        lockedAt: null,
        updatedAt: "2026-10-28T18:01:00Z",
        items: savedEntries,
      },
    } });
  });
  await context.route("**/api/system/barcode/scan", (route) => route.fulfill({ json: {
    result: "granted",
    granted: true,
    member: {
      fullName: "Test Active Member",
      memberNumber: "BGM000123",
      status: "active",
      membershipExpiry: "2027-12-31",
      photoRequired: false,
      photoUrl: null,
    },
  } }));

  await page.goto(origin + "/staff/bar");
  const water = page.getByRole("spinbutton", { name: "Water 500ml quantity" });
  await water.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await water.inputValue(), "2", "Bar loads the saved daily quantity");
  assert.equal(await page.getByRole("button", { name: /SEND BAR LIST/i }).count(), 0, "manual Submit Bar List button is removed");
  assert.equal(await page.getByText("Saved", { exact: true }).count() > 0, true);
  assert.ok((await page.getByLabel("Bar total for today").textContent()).includes("3.00"));

  await page.getByRole("button", { name: "Increase Water 500ml" }).click();
  await page.getByText("Saving…", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
  await page.getByText("Saved", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
  assert.equal(putCount, 1, "+ automatically saves the live daily sheet");
  assert.equal(savedEntries[0].quantity, 3);
  assert.ok((await page.getByLabel("Bar total for today").textContent()).includes("4.50"));

  await page.reload();
  await water.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await water.inputValue(), "3", "reopening Bar shows the same saved daily quantity");

  await water.focus();
  await page.keyboard.press("F9");
  await page.keyboard.type("BGM000123", { delay: 4 });
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await water.inputValue(), "3", "global scanner must not corrupt the Bar quantity");
  await dialog.getByRole("button", { name: "Close / Return to Staff Task" }).click();
  await page.screenshot({ path: artifactDir + "/daily-bar-autosave.png", fullPage: true });

  serverLocked = true;
  await page.reload();
  await page.getByText("End of Day submitted — this Bar sheet is locked.").waitFor({ state: "visible", timeout: 15000 });
  const increase = page.getByRole("button", { name: "Increase Water 500ml" });
  assert.equal(await increase.isDisabled(), true, "End of Day locks the daily Bar sheet");
  assert.equal(await page.getByRole("button", { name: /SEND BAR LIST/i }).count(), 0);
  assert.deepEqual(errors, [], "Daily Bar must not trigger browser errors");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
