import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3131";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3131", "-H", "127.0.0.1"], { stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { logs = (logs + chunk).slice(-4000); });
let browser;
try {
  await mkdir("test-artifacts/member-data", { recursive: true });
  for (let n = 0; ; n++) {
    try { if ((await fetch(origin + "/staff/admin/member-data")).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next.js start failed: " + logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1350, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  let superAdmin = true, previewRequests = 0, applyRequests = 0;

  await context.route("**/api/system/auth", route => route.fulfill({
    json: { authenticated: true, user: { displayName: "TEST Admin", isSuperAdmin: superAdmin } },
  }));
  await context.route("**/api/admin/members/import/preview", route => {
    previewRequests++;
    return route.fulfill({ json: {
      batchId: "11111111-1111-4111-8111-111111111111",
      filename: "bgm-members-test.xlsx", fileFormat: "xlsx", importMode: "exchange_16",
      totalRows: 14, newRows: 0, updateRows: 0, unchangedRows: 14,
      conflictRows: 0, invalidRows: 0, cardRows: 13, blankCardRows: 1, issues: [],
    }});
  });
  await context.route("**/api/admin/members/import/apply", route => {
    applyRequests++;
    assert.equal(route.request().postDataJSON().batchId, "11111111-1111-4111-8111-111111111111");
    return route.fulfill({ json: {
      applied: true, batchId: "11111111-1111-4111-8111-111111111111",
      totalRows: 14, newRows: 0, updateRows: 0, unchangedRows: 14,
      linkedCardCount: 0, blankCardRows: 1,
    }});
  });

  await page.goto(origin + "/staff/admin");
  await page.getByRole("link", { name: /Member import & export/ }).click();
  await page.getByRole("heading", { name: "Member import & export" }).waitFor();
  const xlsx = page.getByRole("link", { name: "Download XLSX" });
  const csv = page.getByRole("link", { name: "Download CSV" });
  assert.equal(await xlsx.getAttribute("href"), "/api/admin/members/export?format=xlsx");
  assert.equal(await csv.getAttribute("href"), "/api/admin/members/export?format=csv");

  await page.locator('input[type="file"]').setInputFiles({
    name: "bgm-members-test.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("fake-xlsx"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();
  await page.getByText("BGM 16-column exchange file").waitFor();
  await page.getByText("Preview complete. No blocking rows found; review the totals before confirming.").waitFor();
  assert.equal(previewRequests, 1);
  await page.screenshot({ path: "test-artifacts/member-data/member-data-preview.png", fullPage: true });

  await page.getByRole("button", { name: "Confirm Import" }).click();
  await page.getByText(/Import applied\. 0 new, 0 updated, 14 unchanged/).waitFor();
  assert.equal(applyRequests, 1);

  superAdmin = false;
  const staff = await context.newPage();
  await staff.goto(origin + "/staff/admin/member-data");
  await staff.getByText("Super Admin access required.").waitFor();

  assert.deepEqual(errors, []);
  console.log("PASS member import/export page, 14-member round-trip preview/apply and Super Admin access gate");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
