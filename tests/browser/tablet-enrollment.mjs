import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3102";
const artifacts = "test-artifacts/tablet-enrollment";

const durations = ["1_week", "2_weeks", "1_month", "3_months", "6_months", "1_year"];
const types = ["single", "student", "couples"];
const pricingEntries = types.flatMap((membershipType, typeIndex) =>
  durations.map((durationKey, durationIndex) => ({
    membershipType,
    durationKey,
    amountCents: 2500 + typeIndex * 1000 + durationIndex * 500,
    currency: "EUR",
  })),
);

const declaration = (id, contentKey, body) => ({
  id,
  contentKey,
  versionNo: 1,
  body,
  contentSha256: `${contentKey}-sha`,
});

const config = {
  gym: {
    id: "bgm-birkirkara-browser",
    name: "Birkirkara Fitness",
    shortName: "Birkirkara Fitness",
    slug: "birkirkara",
  },
  pricing: {
    versionId: "price-browser-v1",
    entries: pricingEntries,
  },
  declarations: {
    gymRules: declaration("rules-browser", "gym_rules", "Browser-test Gym Rules wording."),
    privacy: declaration("privacy-browser", "privacy", "Browser-test privacy wording."),
    health: declaration("health-browser", "health", "Browser-test health wording."),
    guardian: declaration("guardian-browser", "guardian", "Browser-test guardian wording."),
  },
};

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3102", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => {
    serverOutput = (serverOutput + data).slice(-6000);
  });
}

let browser;
let page;
const pageErrors = [];
let submitSeen = false;

async function waitVisible(locator) {
  await locator.waitFor({ state: "visible", timeout: 15000 });
}

async function chooseMembership(typeLabel, duration = "1_month") {
  await page.getByRole("button", { name: typeLabel, exact: true }).click();
  await waitVisible(page.getByRole("heading", { name: "You will need at reception", exact: true }));
  await page
    .locator("label")
    .filter({ hasText: "Membership duration" })
    .locator("select")
    .selectOption(duration);
}

async function continuePastDocumentWarning() {
  await page
    .getByLabel("I understand these requirements and I am ready to continue.", { exact: true })
    .check();
}

async function acceptDeclarations() {
  await page.getByLabel("I have read and agree to the BGM Gym Rules.", { exact: true }).check();
  await page
    .getByLabel("I have read and agree to the Privacy and data processing notice.", { exact: true })
    .check();
  await page.getByLabel("I have read and agree to the Health declaration.", { exact: true }).check();
}

try {
  await mkdir(artifacts, { recursive: true });

  for (let attempt = 0; ; attempt += 1) {
    try {
      if ((await fetch(origin + "/join/birkirkara")).ok) break;
    } catch {}
    if (attempt > 100 || server.exitCode !== null) {
      throw new Error("Next.js did not start: " + serverOutput);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
    });

    Object.defineProperty(HTMLVideoElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return this.__bgmStream || null;
      },
      set(value) {
        this.__bgmStream = value;
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get() {
        return 720;
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get() {
        return 720;
      },
    });
    HTMLMediaElement.prototype.play = function play() {
      return Promise.resolve();
    };
    HTMLCanvasElement.prototype.getContext = function getContext() {
      return { drawImage() {} };
    };
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
      callback(new Blob(["browser-test-webp"], { type: type || "image/webp" }));
    };
  });

  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/public/membership-enrollment/config?*", (route) =>
    route.fulfill({ json: config }),
  );

  await page.route("**/api/public/membership-enrollment/identity-check", async (route) => {
    assert.equal(route.request().method(), "POST");
    const payload = route.request().postDataJSON();
    assert.equal(payload.gymSlug, "birkirkara");
    const state = payload.idNumber === "ACTIVE123" ? "active" : "clear";
    return route.fulfill({ json: { state } });
  });

  await page.route("**/api/public/membership-enrollment/submit", async (route) => {
    assert.equal(route.request().method(), "POST");
    const contentType = route.request().headers()["content-type"] || "";
    assert.match(contentType, /multipart\/form-data/i);
    const raw = route.request().postDataBuffer()?.toString("latin1") || "";
    assert.match(raw, /name="payload"/);
    assert.match(raw, /"membershipType":"student"/);
    assert.match(raw, /name="photo0"/);
    assert.match(raw, /image\/webp/);
    submitSeen = true;
    return route.fulfill({ json: { ok: true, applicationId: "browser-tablet-application" } });
  });

  await page.route("**/join/birkirkara/manifest.webmanifest", (route) =>
    route.fulfill({
      contentType: "application/manifest+json",
      body: JSON.stringify({
        name: "BestGymsMalta Birkirkara Fitness Registration",
        short_name: "BGM Registration",
        start_url: "/join/birkirkara",
        scope: "/join/",
        display: "standalone",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      }),
    }),
  );

  await page.goto(origin + "/join/birkirkara");
  await waitVisible(page.getByText("Birkirkara Fitness", { exact: true }).first());
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "tablet registration must fit the tablet viewport",
  );

  await chooseMembership("Student");
  await waitVisible(page.getByText("Valid student card or supporting student document.", { exact: true }));
  assert.equal(
    await page.getByRole("heading", { name: "Your details", exact: true }).count(),
    0,
    "document warning must appear before personal details",
  );
  await page.screenshot({ path: artifacts + "/student-document-warning.png", fullPage: true });

  await continuePastDocumentWarning();
  await waitVisible(page.getByRole("heading", { name: "Your details", exact: true }));

  await page.getByLabel("First name", { exact: true }).fill("Tablet");
  await page.getByLabel("Last name", { exact: true }).fill("Student");
  const idInput = page.getByLabel("ID card / passport number", { exact: true });
  await idInput.fill("STUDENT123");
  const identityResponse = page.waitForResponse("**/api/public/membership-enrollment/identity-check");
  await idInput.press("Tab");
  await identityResponse;
  await page.getByLabel("Date of birth", { exact: true }).fill("1995-05-20");
  await page.getByLabel("Address", { exact: true }).fill("1 Browser Street");
  await page.getByLabel("Town / locality", { exact: true }).fill("Birkirkara");
  await page.getByLabel("Mobile / phone", { exact: true }).fill("79000000");
  await page.getByLabel("Email", { exact: true }).fill("tablet.student@example.test");
  await page.getByLabel("Next of kin / emergency contact", { exact: true }).fill("Browser Kin 79000001");

  await page.getByRole("button", { name: "Open Camera", exact: true }).click();
  await waitVisible(page.getByRole("button", { name: "Take Photo", exact: true }));
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await waitVisible(page.getByRole("button", { name: "Use Photo", exact: true }));
  await page.getByRole("button", { name: "Use Photo", exact: true }).click();
  await waitVisible(page.getByRole("button", { name: "Photo Ready", exact: true }));

  await acceptDeclarations();
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await waitVisible(
    page.getByRole("heading", {
      name: "Application submitted — please proceed to reception.",
      exact: true,
    }),
  );
  await waitVisible(page.getByText(/Student members: show your valid student ID/i));
  assert.equal(submitSeen, true, "student application must reach the mocked submit endpoint");
  await page.screenshot({ path: artifacts + "/student-success.png", fullPage: true });

  await page.getByRole("button", { name: "Finish / Reset for next member", exact: true }).click();
  await waitVisible(page.getByRole("button", { name: "Couples", exact: true }));
  await chooseMembership("Couples");
  await continuePastDocumentWarning();
  await waitVisible(page.getByText("Couples applicant 1", { exact: true }));
  await waitVisible(page.getByText("Couples applicant 2", { exact: true }));
  assert.equal(
    await page.getByText(/Applicant 1 live membership photo/i).count() >= 1,
    true,
    "Couples must render a first live-photo section",
  );
  assert.equal(
    await page.getByText(/Applicant 2 live membership photo/i).count() >= 1,
    true,
    "Couples must render a second live-photo section",
  );
  await page.screenshot({ path: artifacts + "/couples-two-applicants.png", fullPage: true });

  await page.reload();
  await waitVisible(page.getByText("Birkirkara Fitness", { exact: true }).first());
  await chooseMembership("Regular");
  await continuePastDocumentWarning();
  const activeId = page.getByLabel("ID card / passport number", { exact: true });
  await activeId.fill("ACTIVE123");
  const activeResponse = page.waitForResponse("**/api/public/membership-enrollment/identity-check");
  await activeId.press("Tab");
  await activeResponse;
  await waitVisible(
    page.getByText("An active membership already exists for this ID. Please speak to reception.", {
      exact: true,
    }),
  );
  await page.screenshot({ path: artifacts + "/active-member-block.png", fullPage: true });

  assert.deepEqual(pageErrors, [], "tablet enrollment must not raise browser errors");
  console.log("PASS tablet enrollment student submit, couples render and active-member block");
} catch (error) {
  if (page) {
    await page.screenshot({ path: artifacts + "/failure.png", fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}