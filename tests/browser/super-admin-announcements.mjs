import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3127";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3127", "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", chunk => { logs = (logs + chunk).slice(-4000); });
}
let browser;
try {
  await mkdir("test-artifacts/announcements", { recursive: true });
  for (let n = 0; ; n++) {
    try { if ((await fetch(origin + "/staff/admin/announcements")).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next.js start failed: " + logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1300, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  let superAdmin = true, readCount = 0, uploadCount = 0;
  let announcements = [];
  const calls = [];
  await context.route("**/api/system/auth", route => route.fulfill({
    json: { authenticated: true, user: { displayName: "TEST Admin", isSuperAdmin: superAdmin } },
  }));
  await context.route("**/api/system/admin/announcements", route => {
    if (route.request().method() === "GET") {
      readCount++;
      return route.fulfill({ json: { announcements } });
    }
    const body = route.request().postDataJSON();
    calls.push(body);
    if (body.mode === "create") {
      assert.equal(body.item.active, true);
      assert.equal(body.item.button_text, "Read more");
      assert.equal(body.item.button_url, "https://example.org/bgm-test");
      assert.equal(body.item.image_url, "https://images.example.org/test-news.png");
      const item = { ...body.item, id: "12345678-1234-4234-8234-123456789abc" };
      announcements = [item];
      return route.fulfill({ json: { item } });
    }
    if (body.mode === "update") {
      assert.equal(body.id, announcements[0].id);
      announcements = [{ ...body.item, id: announcements[0].id }];
      return route.fulfill({ json: { item: announcements[0] } });
    }
    if (body.mode === "delete") {
      assert.equal(body.id, announcements[0].id);
      announcements = [];
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 400, json: { error: "Invalid action" } });
  });
  await context.route("**/api/system/admin/announcements/upload", route => {
    assert.equal(route.request().method(), "POST");
    uploadCount++;
    return route.fulfill({ json: { imageUrl: "https://images.example.org/test-news.png" } });
  });
  await page.goto(origin + "/staff/admin");
  await page.getByRole("link", { name: /Announcements/ }).waitFor();
  await page.getByRole("link", { name: /Announcements/ }).click();
  await page.getByRole("heading", { name: "Announcements", exact: true }).waitFor();
  assert.ok(readCount > 0);
  await page.getByRole("textbox", { name: "Announcement title" }).fill("TEST News");
  await page.getByRole("textbox", { name: "Announcement message" }).fill("Sample members update.");
  await page.getByRole("textbox", { name: "Announcement category" }).fill("News");
  await page.getByRole("textbox", { name: "Announcement button text" }).fill("Read more");
  await page.getByRole("textbox", { name: "Announcement button URL" }).fill("https://example.org/bgm-test");
  await page.getByRole("textbox", { name: "Announcement display order" }).fill("2");
  await page.locator('input[aria-label="Upload announcement image"]').setInputFiles({
    name: "news.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YfJbgAAAABJRU5ErkJggg==", "base64"),
  });
  await page.getByRole("status").filter({ hasText: "Image uploaded." }).waitFor();
  assert.equal(uploadCount, 1);
  await page.getByRole("button", { name: "Create announcement" }).click();
  await page.getByRole("status").filter({ hasText: "Announcement saved." }).waitFor();
  const existing = page.getByRole("region", { name: "Existing announcements" });
  await existing.getByRole("heading", { name: "TEST News" }).waitFor();
  assert.equal(announcements.length, 1);
  await existing.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("heading", { name: "Edit announcement" }).waitFor();
  await page.getByRole("textbox", { name: "Announcement title" }).fill("TEST News Updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await existing.getByRole("heading", { name: "TEST News Updated" }).waitFor();
  assert.equal(announcements[0].title, "TEST News Updated");
  await existing.getByRole("button", { name: "Hide" }).click();
  await existing.getByText("Hidden", { exact: false }).waitFor();
  assert.equal(announcements[0].active, false);
  await existing.getByRole("button", { name: "Activate" }).click();
  await existing.getByRole("button", { name: "Hide" }).waitFor();
  assert.equal(announcements[0].active, true);
  await page.screenshot({ path: "test-artifacts/announcements/super-admin-announcements.png", fullPage: true });
  page.once("dialog", dialog => void dialog.accept());
  await existing.getByRole("button", { name: "Delete" }).click();
  await page.getByText("No announcements in this environment yet.").waitFor();
  assert.equal(announcements.length, 0);
  assert.deepEqual(calls.map(x => x.mode), ["create", "update", "update", "update", "delete"]);

  // Member home reuses the legacy public news feed and must honour old button_* fields.
  await context.route("**/api/public/announcements", route => route.fulfill({
    json: { announcement: { id: "news-1", title: "TEST Members News", message: "Public announcement",
      category: "News", button_text: "Read more", button_url: "https://example.org/bgm-test" } },
  }));
  await context.route("**/api/content", route => route.fulfill({
    json: { announcements: [{ id: "news-1", title: "TEST Members News", message: "Public announcement",
      category: "News", button_text: "Read more", button_url: "https://example.org/bgm-test" }] },
  }));
  await page.goto(origin + "/");
  await page.getByRole("heading", { name: "Latest from BGM" }).waitFor();
  const memberNews = page.locator("section").filter({ has: page.getByRole("heading", { name: "Latest from BGM" }) }).last();
  await memberNews.getByText("TEST Members News").waitFor();
  const link = memberNews.locator('a[href="https://example.org/bgm-test"]');
  assert.equal(await link.count(), 1, "Member updates must use original button_url in their link");
  await memberNews.getByText("Read more").waitFor();

  superAdmin = false;
  const staff = await context.newPage();
  await staff.goto(origin + "/staff/admin/announcements");
  await staff.getByText("Super Admin access required.").waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS announcements Super Admin access, create, image upload, edit, hide/activate, delete and member news CTA");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
