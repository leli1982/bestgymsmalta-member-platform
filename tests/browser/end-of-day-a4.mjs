import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3117";
const server = spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3117", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", chunk => { output = (output + chunk).slice(-5000); });
}
let browser;

async function waitForServer() {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin + "/staff/end-of-day")).ok) return; } catch {}
    if (attempt > 120 || server.exitCode !== null) {
      throw new Error("Next server did not start: " + output);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function fixture(count) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    gymName: "Tal Qroqq Gym",
    businessDate: "2026-11-18",
    staffName: "Example Staff",
    memberships: { cashCents: 5000, cardCents: 10000, otherCents: 0 },
    renewals: { cashCents: 2000, cardCents: 1500, otherCents: 0 },
    vouchers: Array.from({ length: count }, (_, i) => ({
      voucherCode: "VOUCHER-" + (i+1), quantity: 1, reimbursementTotalCents: 200,
    })),
    barItems: Array.from({ length: count }, (_, i) => ({
      itemName: "Example bar item " + (i+1), quantity: 1, unitPriceCents: 100, lineTotalCents: 100,
    })),
    voucherReimbursementCents: count * 200,
    barSalesCents: count * 100,
    grossCents: 18500 + count * 100,
    expenses: Array.from({ length: count }, (_, i) => ({
      id: "expense-" + (i+1), description: "Example expense " + (i+1), amountCents: 10,
    })),
    expensesTotalCents: count * 10,
    dailyTotalCents: 18500 + count * 90,
    submittedAt: "2026-11-18T10:00:00.000Z",
  };
}

async function verifySubmittedReport(context, count) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__printTestCalls = 0;
    window.print = () => { window.__printTestCalls += 1; };
  });
  await page.route("**/api/system/end-of-day*", route =>
    route.fulfill({ json: { gymId: "bgm-browser-gym", gymName: "Tal Qroqq Gym",
      businessDate: "2026-11-18", submitted: true, report: fixture(count) } })
  );
  await page.goto(origin + "/staff/end-of-day");
  await page.getByText("End of Day submitted").waitFor({ timeout: 15000 });
  // An already-closed report must not be printed automatically on load.
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__printTestCalls), 0,
    "opening previous report must never trigger automatic print");
  const printed = await page.pdf({ preferCSSPageSize: true, printBackground: false });
  const pageCount = (Buffer.from(printed).toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
  assert.equal(pageCount, 1, "End of Day " + count + " item fixture must fit on one A4 sheet");
  const text = await page.locator(".bgm-eod-print-only").textContent();
  assert.match(text, /END OF DAY TOTAL/);
  assert.match(text, /Example Staff/);
  if (count > 12) assert.match(text, /additional bar items: see digital report/);
  await page.getByRole("button", { name: /PRINT \/ REPRINT A4 END OF DAY/ }).click();
  assert.equal(await page.evaluate(() => window.__printTestCalls), 1, "manual reprint available");
  assert.deepEqual(errors, [], "no browser exceptions");
  await page.close();
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await verifySubmittedReport(context, 3);
  await verifySubmittedReport(context, 70);
  console.log("PASS: monochrome End of Day A4 PDF is one page, no unintended reprint on reopen, manual reprint available");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
