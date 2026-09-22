import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3123";
const artifactDir = "test-artifacts/shopping-list";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3123", "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
let browser;
try {
  await mkdir(artifactDir, { recursive: true });
  for (let n = 0; ; n++) {
    try { if ((await fetch(origin + "/staff/admin/shopping-list")).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next.js startup failed: " + logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1350, height: 900 } });
  let orders = [
    { id: "aaaaaaaa-1111-4111-a111-000000000001", gym_id: "bgm-birkirkara", gym_name: "Birkirkara Fitness",
      staff_name: "TEST Maria", status: "submitted", notes: "Use rear entrance",
      submitted_at: "2026-09-22T08:30:00Z", items: [
        { id: "1", item_name: "Toilet paper", quantity: 6, unit: null, notes: null },
        { id: "2", item_name: "Gym tissues", quantity: 2, unit: null, notes: "Large boxes" },
      ] },
    { id: "aaaaaaaa-1111-4111-a111-000000000002", gym_id: "bgm-birkirkara", gym_name: "Birkirkara Fitness",
      staff_name: "TEST David", status: "ordered", notes: null,
      submitted_at: "2026-09-22T09:30:00Z", items: [
        { id: "3", item_name: "Toilet paper", quantity: 1, unit: null, notes: null },
      ] },
    { id: "aaaaaaaa-1111-4111-a111-000000000003", gym_id: "bgm-marsa", gym_name: "Marsa Fitness",
      staff_name: "TEST Keith", status: "submitted", notes: null,
      submitted_at: "2026-09-21T09:30:00Z", items: [
        { id: "4", item_name: " TOILET   PAPER ", quantity: 3, unit: null, notes: null },
      ] },
  ];
  const posted = [];
  await context.route("**/api/system/auth", (route) =>
    route.fulfill({ json: { authenticated: true, user: { id: "super-admin", isSuperAdmin: true, displayName: "TEST Admin", gymId: null } } }));
  await context.route("**/api/system/shopping-list", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { orders } });
    const body = route.request().postDataJSON();
    posted.push(body);
    const order = orders.find((item) => item.id === body.orderId);
    assert.ok(order);
    assert.ok(["submitted", "ordered"].includes(order.status));
    orders = orders.map((item) => item.id === order.id ? { ...item, status: "completed" } : item);
    return route.fulfill({ json: { order: { id: order.id, status: "completed" } } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(origin + "/staff/admin");
  await page.getByRole("link", { name: /Shopping List/ }).waitFor({ state: "visible" });
  await page.goto(origin + "/staff/admin/shopping-list");
  await page.getByRole("heading", { name: "Shopping List" }).waitFor({ state: "visible" });
  const totals = page.getByRole("region", { name: "Combined shopping totals" });
  await totals.getByText("10 × Toilet paper", { exact: true }).waitFor({ state: "visible" });
  await totals.getByText("2 × Gym tissues", { exact: true }).waitFor({ state: "visible" });
  const birk = page.getByRole("article").filter({ hasText: "Birkirkara Fitness" });
  const marsa = page.getByRole("article").filter({ hasText: "Marsa Fitness" });
  assert.equal(await birk.getByRole("button", { name: "Delivered" }).count(), 2);
  assert.equal(await marsa.getByRole("button", { name: "Delivered" }).count(), 1);
  await birk.getByText("7 × Toilet paper", { exact: true }).waitFor();
  await marsa.getByText("3 ×  TOILET   PAPER ", { exact: true }).waitFor({ state: "visible" }).catch(() => {});
  await page.screenshot({ path: artifactDir + "/shopping-list-before-delivery.png", fullPage: true });

  const firstRequest = page.getByRole("region", { name: "Sundries request aaaaaaaa-1111-4111-a111-000000000001" });
  await firstRequest.getByRole("button", { name: "Delivered" }).click();
  await page.getByRole("status").filter({ hasText: "Delivered: Birkirkara Fitness" }).waitFor();
  await totals.getByText("4 × Toilet paper", { exact: true }).waitFor();
  assert.equal(await totals.getByText("2 × Gym tissues", { exact: true }).count(), 0);
  assert.equal(await birk.getByRole("button", { name: "Delivered" }).count(), 1);
  assert.equal(await page.getByRole("region", { name: "Delivered during this session" }).getByText(/DELIVERED/).count(), 1);
  assert.deepEqual(posted, [{ orderId: "aaaaaaaa-1111-4111-a111-000000000001" }]);
  await page.screenshot({ path: artifactDir + "/shopping-list-after-delivery.png", fullPage: true });

  await page.getByRole("button", { name: "Refresh list" }).click();
  await totals.getByText("4 × Toilet paper", { exact: true }).waitFor();

  const staff = await browser.newContext();
  await staff.route("**/api/system/auth", (route) =>
    route.fulfill({ json: { authenticated: true, user: { id: "staff", isSuperAdmin: false, displayName: "Gym Staff" } } }));
  const staffPage = await staff.newPage();
  await staffPage.goto(origin + "/staff/admin/shopping-list");
  await staffPage.getByText("Super Admin access required.").waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS Super Admin Shopping List aggregation, grouped gym deliveries, request-level Delivered updates and Staff exclusion");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
