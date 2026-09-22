import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3117";
const artifactDir = "test-artifacts/operations-dashboard";
const server = spawn(
  process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3117", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => { output = (output + data).slice(-3600); });
}
let browser;
try {
  await mkdir(artifactDir, { recursive: true });
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin + "/staff/operations")).ok) break; } catch {}
    if (i > 120 || server.exitCode !== null) throw new Error("Next.js startup failed: " + output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const admin = {
    gymId: null, isSuperAdmin: true, displayName: "Operations Browser Super Admin", permissions: [],
  };
  const gyms = [
    { id: "bgm-birkirkara", name: "Birkirkara Fitness", status: "active" },
    { id: "bgm-marsa", name: "Marsa Fitness", status: "active" },
  ];
  const sundries = [
    {
      id: "sundries-birkirkara", order_type: "sundries",
      gym_id: "bgm-birkirkara", gym_name: "Birkirkara Fitness", staff_name: "Maria",
      status: "submitted", submitted_at: "2026-09-22T08:30:00Z",
      business_date: null, total_cents: null,
      email_notification_status: "sent", push_notification_status: "sent",
      notes: "Urgent", items: [{ id: "sundries-line", item_name: "Toilet paper",
        quantity: 4, unit: null, notes: null, unit_price_cents: null, line_total_cents: null }],
    },
    {
      id: "sundries-marsa", order_type: "sundries",
      gym_id: "bgm-marsa", gym_name: "Marsa Fitness", staff_name: "David",
      status: "ordered", submitted_at: "2026-09-22T07:30:00Z",
      business_date: null, total_cents: null,
      email_notification_status: "failed", push_notification_status: "sent",
      notes: null, items: [{ id: "sundries-line-marsa", item_name: "Hand soap",
        quantity: 2, unit: null, notes: null, unit_price_cents: null, line_total_cents: null }],
    },
  ];
  const bar = [
    {
      id: "bar-birkirkara", order_type: "bar",
      gym_id: "bgm-birkirkara", gym_name: "Birkirkara Fitness", staff_name: "Keith",
      status: "submitted", submitted_at: "2026-09-22T09:30:00Z",
      business_date: "2026-09-22", total_cents: 875, cash_found_cents: 875,
      email_notification_status: "sent", push_notification_status: "sent",
      notes: "Morning", items: [{ id: "bar-line", item_name: "Water", quantity: 5,
        unit: null, notes: null, unit_price_cents: 175, line_total_cents: 875 }],
    },
    {
      id: "bar-marsa", order_type: "bar", gym_id: "bgm-marsa", gym_name: "Marsa Fitness",
      staff_name: "Regina", status: "submitted", submitted_at: "2026-09-22T08:15:00Z",
      business_date: "2026-09-22", total_cents: 250, cash_found_cents: 375,
      email_notification_status: "sent", push_notification_status: "sent",
      notes: null, items: [{ id: "bar-line-marsa", item_name: "Coffee",
        quantity: 2, unit: null, notes: null, unit_price_cents: 125, line_total_cents: 250 }],
    },
  ];
  const captured = [];
  await context.route("**/api/system/auth", (route) =>
    route.fulfill({ json: { authenticated: true, user: admin } }));
  await context.route("**/api/gyms", (route) =>
    route.fulfill({ json: { gyms } }));
  await context.route("**/api/system/orders?**", (route) => {
    const url = new URL(route.request().url());
    captured.push(url.searchParams.toString());
    const type = url.searchParams.get("type");
    const gym = url.searchParams.get("gymId");
    assert.ok(url.searchParams.get("businessDate") || url.searchParams.has("type"));
    const items = (type === "sundries" ? sundries : bar)
      .filter((item) => !gym || item.gym_id === gym);
    return route.fulfill({ json: { orders: items } });
  });
  let update = null;
  await context.route("**/api/system/orders", (route) => {
    assert.equal(route.request().method(), "PATCH");
    update = route.request().postDataJSON();
    assert.equal(update.orderId, "sundries-birkirkara");
    assert.equal(update.status, "ordered");
    assert.equal(update.staffName, "Super Admin");
    sundries[0].status = "ordered";
    return route.fulfill({ json: { order: { id: update.orderId, status: update.status } } });
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + "/staff/operations");
  await page.getByRole("heading", { name: "Operations dashboard" })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.getByText("4 records shown").waitFor({ state: "visible", timeout: 15000 });
  const filterColors = await page.getByRole("combobox", { name: "Filter operations gym" }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, colorScheme: style.colorScheme };
  });
  assert.deepEqual(filterColors, {
    background: "rgb(255, 255, 255)", color: "rgb(24, 24, 27)", colorScheme: "light",
  }, "Super Admin operations filters must have readable light theme");
  assert.equal(await page.getByRole("article").count(), 4);
  for (const [id, expectedColor] of [
    ["bar-birkirkara", "rgb(4, 120, 87)"],
    ["bar-marsa", "rgb(185, 28, 28)"],
  ]) {
    const order = page.getByRole("article").filter({ hasText: id });
    const value = order.locator("span.tabular-nums").first();
    assert.equal(await value.evaluate((element) => getComputedStyle(element).color), expectedColor);
    await order.getByRole("button", { name: "Show details for " + id }).click();
    const detail = order.getByText("Total Sales:").locator("span");
    assert.equal(await detail.evaluate((element) => getComputedStyle(element).color), expectedColor);
  }
  await page.getByText("€11.25").first().waitFor();
  await page.getByText("Notification failures").waitFor();
  await page.getByRole("button", { name: "Show details for sundries-birkirkara" }).click();
  await page.getByText("Toilet paper × 4").waitFor();
  await page.getByRole("button", { name: "Mark ordered" }).first().click();
  await page.getByRole("status").filter({ hasText: "marked ordered" }).first()
    .waitFor({ state: "visible", timeout: 15000 });
  assert.deepEqual(update, {
    orderId: "sundries-birkirkara", status: "ordered", staffName: "Super Admin",
  });
  await page.getByRole("combobox", { name: "Filter operations gym" })
    .selectOption("bgm-marsa");
  await page.getByText("2 records shown").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await page.getByRole("article").count(), 2);
  await page.getByRole("combobox", { name: "Filter operations type" }).selectOption("bar");
  await page.getByText("1 records shown").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("article").count(), 1);
  await page.getByRole("combobox", { name: "Filter operations gym" }).selectOption("");
  await page.getByText("2 records shown").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "All dates" }).click();
  assert.equal(await page.locator('input[aria-label="Filter operations date"]').inputValue(), "");
  assert.equal(captured.some((params) => params.includes("gymId=bgm-marsa")), true);
  await page.screenshot({ path: artifactDir + "/super-admin-operations.png", fullPage: true });

  await page.goto(origin + "/staff/admin");
  await page.getByRole("heading", { name: "Super Admin", exact: true })
    .waitFor({ state: "visible", timeout: 15000 });
  for (const name of [
    "Operations dashboard", "Bar reports", "Bar catalogue & prices", "Membership settings",
  ]) {
    await page.getByRole("link", { name: new RegExp(name) }).first()
      .waitFor({ state: "visible" });
  }
  assert.equal(await page.locator('a[href="/staff/bar/catalog"]').count(), 1);
  assert.equal(await page.locator('a[href="/staff/bar/reports"]').count(), 1);
  await page.screenshot({ path: artifactDir + "/super-admin-home.png", fullPage: true });

  const staffContext = await browser.newContext();
  await staffContext.route("**/api/system/auth", (route) =>
    route.fulfill({ json: { authenticated: true, user: {
      gymId: "bgm-birkirkara", isSuperAdmin: false, permissions: ["orders.bar.submit"],
    } } }));
  await staffContext.route("**/api/gyms", (route) => route.fulfill({ json: { gyms } }));
  const ordinaryStaff = await staffContext.newPage();
  await ordinaryStaff.goto(origin + "/staff/admin");
  await ordinaryStaff.getByText("Super Admin access required.").waitFor({ state: "visible" });
  assert.equal(await ordinaryStaff.locator('a[href="/staff/bar/catalog"]').count(), 0);
  await ordinaryStaff.goto(origin + "/staff/operations");
  await ordinaryStaff.getByText("Super Admin access required.").waitFor({ state: "visible" });
  assert.equal(await ordinaryStaff.getByRole("heading", { name: "Operations dashboard" }).count(), 0);
  assert.deepEqual(pageErrors, []);
  console.log("PASS Super Admin cross-gym operations filters, Bar totals, Sundries status update and ordinary Staff exclusion");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
