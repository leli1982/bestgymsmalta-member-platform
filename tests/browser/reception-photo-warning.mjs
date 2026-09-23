import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3104";
const artifacts = "test-artifacts/reception-photo";

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3104", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] }
);

let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => {
    serverOutput = (serverOutput + data).slice(-6000);
  });
}

let browser;

async function waitForServer() {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin + "/staff/reception")).ok) return;
    } catch {}
    if (attempt > 100 || server.exitCode !== null) {
      throw new Error("Next.js did not start: " + serverOutput);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

try {
  await mkdir(artifacts, { recursive: true });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/system/auth", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: {
          id: "reception-browser-user",
          gymId: "bgm-browser-gym",
          displayName: "Browser Reception",
          isSuperAdmin: false,
          permissions: ["barcode.scan", "members.photos.capture", "members.photos.view"],
        },
      },
    })
  );

  await page.route("**/api/gyms", (route) =>
    route.fulfill({
      json: {
        gyms: [{ id: "bgm-browser-gym", name: "Browser Gym", status: "active" }],
      },
    })
  );

  // A private, fictional image returned by the mocked photo API.
  const mockPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
    "base64"
  );
  let saved = false;
  let photoWrites = 0;
  let photoReads = 0;
  await page.route("**/api/system/members/photo/member-photo-warning?*", (route) => {
    photoReads++;
    assert.equal(route.request().method(), "GET");
    const url = new URL(route.request().url());
    assert.equal(url.searchParams.get("inline"), "1");
    return route.fulfill({ body: mockPng, contentType: "image/png",
      headers: { "cache-control": "private, no-store" } });
  });
  await page.route("**/api/system/members/photo", (route) => {
    assert.equal(route.request().method(), "POST");
    const form = route.request().postDataBuffer().toString("latin1");
    assert.match(form, /member-photo-warning/);
    assert.match(form, /reception_capture/);
    photoWrites++;
    saved = true;
    return route.fulfill({ json: { ok: true, captured: true,
      photoUrl: "/api/system/members/photo/member-photo-warning?inline=1&v=browser-1" } });
  });

  let scans = 0;
  await page.route("**/api/system/barcode/scan", async (route) => {
    assert.equal(route.request().method(), "POST");
    const payload = route.request().postDataJSON();
    assert.equal(payload.membershipNumber, "BGM-CARD-WARN");
    scans += 1;
    return route.fulfill({
      json: {
        result: "granted",
        granted: true,
        duplicate: scans > 1,
        scanId: `scan-${scans}`,
        scannedAt: "2026-09-18T08:00:00.000Z",
        scannedBarcode: "BGM-CARD-WARN",
        cardStatus: "active",
        gym: { id: "bgm-browser-gym", name: "Browser Gym" },
        member: {
          id: "member-photo-warning",
          memberNumber: "BGM0000999",
          fullName: "Photo Warning Member",
          status: "active",
          membershipExpiry: "2027-09-18",
          enrollmentGymId: "bgm-browser-gym",
          enrollmentGymName: "Browser Gym",
          hasPhoto: saved,
          photoRequired: !saved,
          photoUrl: saved
            ? "/api/system/members/photo/member-photo-warning?inline=1&v=browser-1"
            : null,
        },
      },
    });
  });

  await page.goto(origin + "/staff/reception");
  await page.getByRole("heading", { name: "READY TO SCAN", exact: true }).waitFor();

  async function scanAndVerify(repeat) {
    const input = page.getByPlaceholder("Barcode scanner input");
    await input.fill("BGM-CARD-WARN");
    await page.getByRole("button", { name: "Process Barcode", exact: true }).click();

    await page.getByText("ACCESS GRANTED", { exact: true }).waitFor();
    await page.getByText("PHOTO REQUIRED", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Take Photo with Webcam", exact: true }).waitFor();
    await page.getByRole("button", { name: "Upload Photo", exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Allow Entry / Close", exact: true }).waitFor();

    const mainClass = await page.locator("main").first().getAttribute("class");
    assert.match(mainClass || "", /bg-green-600/, "valid access remains green");

    if (!repeat) {
      await page.screenshot({ path: artifacts + "/photo-warning-granted.png", fullPage: true });
    }

    await page.getByRole("button", { name: "Allow Entry / Close", exact: true }).click();
    await page.getByRole("heading", { name: "READY TO SCAN", exact: true }).waitFor();
  }

  await scanAndVerify(false);
  await scanAndVerify(true);

  assert.equal(scans, 2, "missing-photo warning must repeat on the next scan");

  // On the third visit, a verified photo upload clears the warning; on the fourth
  // visit the scanner loads the photo and does not request a new capture.
  const input = page.getByPlaceholder("Barcode scanner input");
  await input.fill("BGM-CARD-WARN");
  await page.getByRole("button", { name: "Process Barcode", exact: true }).click();
  await page.getByRole("button", { name: "Take Photo with Webcam", exact: true }).waitFor();
  await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
    name: "fictional-photo.png", mimeType: "image/png", buffer: mockPng,
  });
  await page.getByRole("button", { name: "Use Photo", exact: true }).waitFor();
  await page.getByRole("button", { name: "Use Photo", exact: true }).click();
  await page.getByRole("img", { name: "Photo Warning Member official photo" }).waitFor();
  await page.getByRole("img", { name: "Photo Warning Member official photo" }).evaluate(async image => {
    if (!(image instanceof HTMLImageElement)) throw new Error("Expected real image element");
    if (!image.complete) await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
    });
    if (!image.naturalWidth) throw new Error("Saved image did not render");
  });
  assert.equal(await page.getByText("PHOTO REQUIRED", { exact: true }).count(), 0,
    "Warning must disappear only after saved photo is verified and shown");
  assert.equal(photoWrites, 1);
  assert.ok(photoReads >= 1, "Save must verify authenticated photo retrieval");
  await page.getByRole("button", { name: "Scan Next Member", exact: true }).click();
  await input.fill("BGM-CARD-WARN");
  await page.getByRole("button", { name: "Process Barcode", exact: true }).click();
  await page.getByText("ACCESS GRANTED", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Photo Warning Member official photo" }).waitFor();
  assert.equal(await page.getByText("PHOTO REQUIRED", { exact: true }).count(), 0);
  assert.equal(scans, 4);
  assert.deepEqual(pageErrors, [], "reception photo warning flow must not raise browser errors");
  console.log("PASS photo warning repeats, fictional official photo is saved/verified/displayed and rescan has no warning");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
