import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3115";
const artifactDir = "test-artifacts/bar-sales";
async function assertLightAdminControl(control, label) {
  const appearance = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, colorScheme: style.colorScheme };
  });
  assert.equal(appearance.background, "rgb(255, 255, 255)", label + " must have a white input background");
  assert.equal(appearance.color, "rgb(24, 24, 27)", label + " must have dark readable input text");
  assert.equal(appearance.colorScheme, "light", label + " must use the light native control palette");
}

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
    assert.equal(submitted.cashFoundCents, 1265, "Cash must be submitted separately from calculated sales.");
    assert.deepEqual(submitted.barEntries, [
      { catalogItemId: "protein", quantity: 1, expectedPriceCents: 225 },
      { catalogItemId: "water", quantity: 2, expectedPriceCents: 150 },
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
  assert.equal(await page.getByRole("link", { name: "Edit Bar List" }).count(), 0, "Gym Staff must not be offered catalogue editing");
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
  await page.getByRole("textbox", { name: "Total Cash Found" }).fill("12.65");
  await page.getByLabel("Total Sales calculated").waitFor({ state: "visible" });
  assert.ok((await page.getByLabel("Total Sales calculated").textContent()).includes("8.75"));
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
  assert.equal(await page.getByRole("textbox", { name: "Total Cash Found" }).inputValue(), "12.65");
  assert.equal(await water.inputValue(), "2");
  assert.equal(await page.getByRole("textbox", { name: "Other item 1 name" }).inputValue(), "Forgotten drink");
  assert.equal(await page.getByRole("textbox", { name: "Bar List notes" }).inputValue(), "Evening shift");
  await page.screenshot({ path: artifactDir + "/staff-bar-with-quantities.png", fullPage: true });

  await page.getByRole("button", { name: "SEND BAR LIST" }).click();
  await page.getByRole("status").filter({ hasText: "Email sent to Super Admin" })
    .waitFor({ state: "visible", timeout: 15000 });
  assert.ok(submitted, "Staff submission must reach the orders endpoint");
  assert.equal(await water.inputValue(), "0", "Successful submission resets the draft");
  assert.equal(await page.getByRole("textbox", { name: "Total Cash Found" }).inputValue(), "", "New shift starts with blank cash count");
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
  await admin.goto(origin + "/staff/bar");
  const editBarList = admin.getByRole("link", { name: "Edit Bar List" });
  await editBarList.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await editBarList.getAttribute("href"), "/staff/bar/catalog");
  await editBarList.click();
  await admin.getByRole("heading", { name: "Bar catalogue & prices" })
    .waitFor({ state: "visible", timeout: 15000 });
  await admin.getByRole("textbox", { name: "New Bar product name" })
    .waitFor({ state: "visible", timeout: 15000 });
  await assertLightAdminControl(admin.getByRole("textbox", { name: "New Bar product name" }), "New Bar product");
  await assertLightAdminControl(admin.getByRole("textbox", { name: "New Bar unit price" }), "New Bar price");
  await admin.getByRole("textbox", { name: "New Bar product name" }).fill("Orange juice");
  await admin.getByRole("textbox", { name: "New Bar unit price" }).fill("2.90");
  await admin.getByRole("button", { name: "Add product" }).click();
  await admin.getByRole("textbox", { name: "Orange juice name" }).waitFor();
  assert.equal(await admin.getByRole("textbox", { name: "Orange juice price" }).inputValue(), "2.90");
  await assertLightAdminControl(admin.getByRole("textbox", { name: "Orange juice price" }), "Published product price");

  // Initial sheet must be reviewed by Super Admin before it appears in Staff Bar.
  const starterContext = await browser.newContext({ viewport: { width: 1130, height: 850 } });
  let starterPublished = [];
  await starterContext.route("**/api/system/auth", (route) => route.fulfill({
    json: { authenticated: true, user: { ...staff, isSuperAdmin: true, displayName: "Super Admin" } },
  }));
  await starterContext.route("**/api/system/bar/catalog?starter=1", (route) => {
    assert.equal(route.request().method(), "GET");
    return route.fulfill({ json: {
      items: [
        { name: "Still Small Water", priceCents: 80, sortOrder: 10 },
        { name: "Isotonic", priceCents: 200, sortOrder: 20 },
      ],
      reviewNotes: ["Isotonic is €2.00 based on the handwritten price correction."],
    } });
  });
  await starterContext.route("**/api/system/bar/catalog", (route) => {
    if (route.request().method() === "POST") {
      assert.deepEqual(route.request().postDataJSON(), {
        starterImport: true, confirmation: "PUBLISH_STARTER_BAR_CATALOG",
      });
      starterPublished = [
        { id: "seed-water", name: "Still Small Water", priceCents: 80, isOther: false, active: true, sortOrder: 10 },
        { id: "seed-isotonic", name: "Isotonic", priceCents: 200, isOther: false, active: true, sortOrder: 20 },
        { id: "seed-others", name: "Others", priceCents: null, isOther: true, active: true, sortOrder: 9999 },
      ];
      return route.fulfill({ status: 201, json: { importedCount: starterPublished.length } });
    }
    return route.fulfill({ json: { items: starterPublished } });
  });
  const starterAdmin = await starterContext.newPage();
  await starterAdmin.goto(origin + "/staff/bar/catalog");
  await starterAdmin.getByRole("button", { name: "Review starter sheet" }).click();
  await starterAdmin.getByLabel("Starter Bar Sales sheet preview")
    .getByRole("cell", { name: "Isotonic", exact: true }).waitFor({ state: "visible", timeout: 15000 });
  await starterAdmin.getByRole("button", { name: "Publish 2 products + Others to Staff" }).click();
  await starterAdmin.getByRole("textbox", { name: "Isotonic price" })
    .waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await starterAdmin.getByRole("textbox", { name: "Isotonic price" }).inputValue(), "2.00");
  assert.equal(starterPublished.length, 3);
  await starterContext.close();

  await adminContext.route("**/api/system/orders?**", (route) =>
    route.fulfill({ json: { orders: [{
      id: "bar-browser-report", gym_id: gym.id, gym_name: gym.name,
      staff_name: "Maria", status: "submitted", business_date: "2026-09-21", cash_found_cents: 1265,
      submitted_at: "2026-09-21T17:00:00Z", total_cents: 875, notes: "Evening shift",
      email_notification_status: "sent", push_notification_status: "sent",
      items: [{ id: "line-1", item_name: "Water 500ml", quantity: 2,
        unit_price_cents: 150, line_total_cents: 300, notes: null }],
    }, {
      id: "bar-equal-cash", gym_id: gym.id, gym_name: gym.name,
      staff_name: "Test Equal", status: "submitted", business_date: "2026-09-21",
      cash_found_cents: 290, total_cents: 290, notes: null,
      submitted_at: "2026-09-21T18:00:00Z", email_notification_status: "sent",
      push_notification_status: "not_configured", items: [],
    }, {
      id: "bar-above-cash", gym_id: gym.id, gym_name: gym.name,
      staff_name: "Test Above", status: "submitted", business_date: "2026-09-21",
      cash_found_cents: 0, total_cents: 175, notes: null,
      submitted_at: "2026-09-21T18:05:00Z", email_notification_status: "sent",
      push_notification_status: "not_configured", items: [],
    }, {
      id: "bar-missing-cash", gym_id: gym.id, gym_name: gym.name,
      staff_name: "Legacy", status: "submitted", business_date: "2026-09-21",
      cash_found_cents: null, total_cents: 150, notes: null,
      submitted_at: "2026-09-21T18:10:00Z", email_notification_status: "sent",
      push_notification_status: "not_configured", items: [],
    }] } }));
  await admin.goto(origin + "/staff/bar/reports");
  await admin.getByText("Water 500ml × 2").waitFor({ state: "visible", timeout: 15000 });
  await admin.getByRole("article").filter({ hasText: "bar-browser-report" }).getByText("Birkirkara Fitness").waitFor();
  await admin.getByText("€8.75").first().waitFor();
  await admin.getByRole("article").filter({ hasText: "bar-browser-report" }).getByText("Total Cash Found:").waitFor();
  await admin.getByText("€12.65").waitFor();
  for (const [id, amount, expectedColor] of [
    ["bar-browser-report", "€8.75", "rgb(185, 28, 28)"],
    ["bar-equal-cash", "€2.90", "rgb(4, 120, 87)"],
    ["bar-above-cash", "€1.75", "rgb(4, 120, 87)"],
    ["bar-missing-cash", "€1.50", "rgb(9, 9, 11)"],
  ]) {
    const article = admin.getByRole("article").filter({ hasText: id });
    const value = article.locator("p.text-2xl");
    assert.equal((await value.textContent()).trim(), amount);
    assert.equal(await value.evaluate((element) => getComputedStyle(element).color), expectedColor);
  }
  await admin.screenshot({ path: artifactDir + "/super-admin-bar-report.png", fullPage: true });
  console.log("PASS Bar Staff prices, +/- quantities, Others, submitted totals, scanner preservation, Super Admin catalogue and reports");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
