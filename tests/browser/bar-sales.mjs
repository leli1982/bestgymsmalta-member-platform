import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3115";
const artifactDir = "test-artifacts/bar-sales";
const server = spawn(
  process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3115", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (d) => { logs = (logs + d).slice(-3000); });
}

let browser;
try {
  await mkdir(artifactDir, { recursive: true });
  for (let n = 0; ; n++) {
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
    gymId: gym.id, displayName: "Bar Browser Staff", isSuperAdmin: false,
    permissions: ["barcode.scan", "orders.bar.submit"],
  };
  let dayCents = 375, dayCount = 1, submitted = null;
  let products = [
    { id: "water", name: "Water 500ml", priceCents: 150, isOther: false, active: true, sortOrder: 0, updatedAt: "2026-09-21" },
    { id: "protein", name: "Protein bar", priceCents: 225, isOther: false, active: true, sortOrder: 1, updatedAt: "2026-09-21" },
    { id: "others", name: "Others", priceCents: null, isOther: true, active: true, sortOrder: 2, updatedAt: "2026-09-21" },
  ];
  await context.route("**/api/system/auth", (route) =>
    route.fulfill({ json: { authenticated: true, user: staff } }));
  await context.route("**/api/gyms", (route) =>
    route.fulfill({ json: { gyms: [gym] } }));
  await context.route("**/api/system/bar/catalog", (route) =>
    route.fulfill({ json: { items: products } }));
  await context.route("**/api/system/bar/today?**", (route) =>
    route.fulfill({ json: {
      gymId: gym.id, businessDate: "2026-09-21", totalCents: dayCents,
      submittedCount: dayCount, unpricedCount: 0,
    } }));
  await context.route("**/api/system/barcode/scan", (route) =>
    route.fulfill({ json: {
      result: "granted", granted: true,
      member: { fullName: "Test Active Member", memberNumber: "BGM000123",
        status: "active", membershipExpiry: "2027-12-31",
        photoRequired: false, photoUrl: null },
    } }));
  await context.route("**/api/system/orders", (route) => {
    assert.equal(route.request().method(), "POST");
    submitted = route.request().postDataJSON();
    assert.equal(submitted.orderType, "bar");
    assert.equal(submitted.gymId, undefined, "Staff must not be able to select another gym");
    assert.equal(submitted.staffName, "Maria");
    assert.equal(submitted.notes, "Evening shift");
    assert.deepEqual(submitted.barEntries, [
      { catalogItemId: "water", quantity: 2, expectedPriceCents: 150 },
      { catalogItemId: "protein", quantity: 1, expectedPriceCents: 225 },
      { catalogItemId: "others", quantity: 2, otherName: "Forgotten drink", otherPriceCents: 175 },
    ]);
    dayCents += 875;
    dayCount++;
    return route.fulfill({
      status: 201, json: {
        order: { id: "test-bar-order", gym_name: gym.name, total_cents: 875 },
        emailNotificationStatus: "sent",
      },
    });
  });

  await page.goto(origin + "/staff/bar");
  const name = page.getByRole("textbox", { name: "Bar Staff name" });
  await name.waitFor({ state: "visible", timeout: 15000 });
  await name.fill("Maria");
  await page.getByRole("button", { name: "Increase Water 500ml" }).click();
  await page.getByRole("button", { name: "Increase Water 500ml" }).click();
  await page.getByRole("button", { name: "Increase Protein bar" }).click();
  assert.equal(await page.getByRole("spinbutton", { name: "Water 500ml quantity" }).inputValue(), "2");
  await page.getByRole("button", { name: "Add other item" }).click();
  await page.getByRole("textbox", { name: "Other item 1 name" }).fill("Forgotten drink");
  await page.getByRole("textbox", { name: "Other item 1 unit price" }).fill("1.75");
  await page.getByRole("button", { name: "Increase Other item 1" }).click();
  await page.getByRole("button", { name: "Increase Other item 1" }).click();
  await page.getByRole("textbox", { name: "Bar List notes" }).fill("Evening shift");
  await page.getByText("BAR TOTAL FOR THE DAY").waitFor();
  assert.equal(await page.getByText("€12.50").count() > 0, true, "Daily total includes earlier and unsent lists");

  const water = page.getByRole("spinbutton", { name: "Water 500ml quantity" });
  await water.focus();
  await page.keyboard.press("F9");
  await page.keyboard.type("BGM000123", { delay: 4 });
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "ACCESS GRANTED" });
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await water.inputValue(), "2", "Scan must not overwrite selected quantity");
  await dialog.getByRole("button", { name: "Close / Return to Staff Task" }).click();
  assert.equal(await name.inputValue(), "Maria");
  assert.equal(await water.inputValue(), "2");
  assert.equal(await page.getByRole("textbox", { name: "Other item 1 name" }).inputValue(), "Forgotten drink");
  assert.equal(await page.getByRole("textbox", { name: "Bar List notes" }).inputValue(), "Evening shift");
  await page.screenshot({ path: artifactDir + "/staff-bar-with-quantities.png", fullPage: true });

  await page.getByRole("button", { name: "SEND BAR LIST" }).click();
  await page.getByRole("status").filter({ hasText: "Email sent to Super Admin" })
    .waitFor({ state: "visible", timeout: 15000 });
  assert.ok(submitted, "Staff submission must reach the orders endpoint");
  assert.equal(await water.inputValue(), "0", "Successful submission resets the draft");
  await page.getByText("BAR TOTAL FOR THE DAY").waitFor();
  assert.equal(await page.getByText("€12.50").count() > 0, true);
  assert.deepEqual(errors, [], "Bar List must not trigger browser errors");

  const adminContext = await browser.newContext({ viewport: { width: 1130, height: 850 } });
  await adminContext.route("**/api/system/auth", (route) => route.fulfill({ json: {
    authenticated: true, user: { ...staff, isSuperAdmin: true, displayName: "Super Admin" },
  } }));
  await adminContext.route("**/api/gyms", (route) => route.fulfill({ json: { gyms: [gym] } }));
  await adminContext.route("**/api/system/bar/catalog", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      assert.equal(body.name, "Orange juice");
      assert.equal(body.priceCents, 290);
      products = [...products, {
        id: "orange", name: body.name, priceCents: body.priceCents, isOther: false,
        active: true, sortOrder: body.sortOrder, updatedAt: "2026-09-21",
      }];
      return route.fulfill({ status: 201, json: { item: products.at(-1) } });
    }
    return route.fulfill({ json: { items: products } });
  });
  const admin = await adminContext.newPage();
  await admin.goto(origin + "/staff/bar/catalog");
  await admin.getByRole("textbox", { name: "New Bar product name" })
    .waitFor({ state: "visible", timeout: 15000 });
  await admin.getByRole("textbox", { name: "New Bar product name" }).fill("Orange juice");
  await admin.getByRole("textbox", { name: "New Bar unit price" }).fill("2.90");
  await admin.getByRole("button", { name: "Add product" }).click();
  await admin.getByRole("textbox", { name: "Orange juice name" }).waitFor();
  assert.equal(await admin.getByRole("textbox", { name: "Orange juice price" }).inputValue(), "2.90");

  await adminContext.route("**/api/system/orders?**", (route) =>
    route.fulfill({ json: { orders: [{
      id: "bar-browser-report", gym_id: gym.id, gym_name: gym.name,
      staff_name: "Maria", status: "submitted", business_date: "2026-09-21",
      submitted_at: "2026-09-21T17:00:00Z", total_cents: 875, notes: "Evening shift",
      email_notification_status: "sent", push_notification_status: "sent",
      items: [{ id: "line-1", item_name: "Water 500ml", quantity: 2,
        unit_price_cents: 150, line_total_cents: 300, notes: null }],
    }] } }));
  await admin.goto(origin + "/staff/bar/reports");
  await admin.getByText("Water 500ml × 2").waitFor({ state: "visible", timeout: 15000 });
  await admin.getByText("Birkirkara Fitness").first().waitFor();
  await admin.getByText("€8.75").first().waitFor();
  await admin.screenshot({ path: artifactDir + "/super-admin-bar-report.png", fullPage: true });
  console.log("PASS Bar Staff prices, +/- quantities, Others, submitted totals, scanner preservation, Super Admin catalogue and reports");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
