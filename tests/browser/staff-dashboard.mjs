import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3101";
const artifacts = "test-artifacts/staff-ui";
const user = {
  id: "browser-staff-user",
  gymId: "bgm-browser-gym",
  username: "browser-gym",
  displayName: "Browser Gym Reception",
  isSuperAdmin: false,
  permissions: [
    "members.view",
    "members.create",
    "members.renew",
    "members.photos.view",
    "members.photos.capture",
    "membership.activate",
    "cards.assign",
    "cards.replace",
    "barcode.scan",
    "orders.sundries.submit",
    "orders.bar.submit",
  ],
};
const member = {
  id: "browser-member",
  memberNumber: "0012345",
  firstName: "Existing",
  lastName: "Member",
  fullName: "Existing Member",
  status: "active",
  classification: "active",
  membershipExpiry: "2027-12-31",
  mobile: "79000000",
  email: "existing@example.test",
  idNumber: "123456M",
  enrollmentGymId: "bgm-browser-gym",
  legacyPkCustomer: "",
  legacyGym: "Browser Gym",
  photoUrl: null,
};

let cardAssigned = false;
let idVerified = false;
let activated = false;
const applicationId = "app-browser";
const participantId = "participant-browser";

function queueApplication() {
  return {
    id: applicationId,
    reference: "BGMAPP-BROWSER",
    kind: "new",
    status: "awaiting_payment",
    membershipType: "single",
    enrollmentGymId: "bgm-browser-gym",
    enrollmentGymName: "Browser Gym",
    submittedAt: "2026-09-15T11:00:00.000Z",
    createdAt: "2026-09-15T11:00:00.000Z",
    participants: [
      {
        id: participantId,
        participantOrder: 1,
        fullName: "Browser Queue Member",
        hasPhoto: true,
        cardAssigned,
        reservedBarcode: cardAssigned ? "CARD-12345" : null,
      },
    ],
  };
}

function applicationDetail() {
  return {
    id: applicationId,
    reference: "BGMAPP-BROWSER",
    kind: "new",
    status: "awaiting_payment",
    membershipType: "single",
    durationKey: "1_month",
    startDate: "2026-09-15",
    expiryDate: "2026-10-15",
    enrollmentGymId: "bgm-browser-gym",
    enrollmentGymName: "Browser Gym",
    submittedAt: "2026-09-15T11:00:00.000Z",
    paymentReceivedAt: null,
    activatedAt: null,
    basePriceCents: 3000,
    currency: "EUR",
    priceCatalogVersionId: "catalog-browser",
    declarationSnapshot: {
      gymRules: { versionNo: 1, body: "Browser gym rules" },
      privacy: { versionNo: 1, body: "Browser privacy notice" },
      health: { versionNo: 1, body: "Browser health declaration" },
    },
    sameAddressVerified: false,
    participants: [
      {
        id: participantId,
        participantOrder: 1,
        existingMemberId: null,
        matchedMemberId: null,
        identityMatchState: "clear",
        duplicateContactWarning: false,
        under18AtSubmission: false,
        firstName: "Browser",
        lastName: "Queue Member",
        addressLine1: "1 Test Street",
        addressLine2: "",
        town: "Browser Town",
        postcode: "BGM 1000",
        idNumber: "999999M",
        dateOfBirth: "1990-01-01",
        phone: "79000001",
        email: "queue@example.test",
        nextOfKin: "Test Kin",
        guardianName: "",
        guardianIdNumber: "",
        guardianRelationship: "",
        guardianPhone: "",
        guardianEmail: "",
        guardianAddress: "",
        idVerified,
        studentEligibilityVerified: false,
        guardianPresentVerified: false,
        guardianCosignVerified: false,
        hasPhoto: true,
        photoUrl: null,
        reservedBarcode: cardAssigned ? "CARD-12345" : null,
        currentBarcode: null,
        cardVerified: false,
        renewalCardAction: null,
        scannedBarcode: null,
      },
    ],
  };
}

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3101", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] }
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

async function waitVisible(locator) {
  await locator.waitFor({ state: "visible", timeout: 15000 });
}

try {
  await mkdir(artifacts, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin + "/staff")).ok) break;
    } catch {}
    if (attempt > 100 || server.exitCode !== null) {
      throw new Error("Next.js did not start: " + serverOutput);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/system/auth", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ json: { authenticated: true, user } });
    }
    if (method === "DELETE") {
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: "Unexpected auth method" } });
  });

  await page.route("**/api/system/staff/realtime", (route) =>
    route.fulfill({ json: { enabled: false } })
  );

  let homeScanCount = 0;
  await page.route("**/api/system/barcode/scan", (route) => {
    assert.equal(route.request().method(), "POST");
    const payload = route.request().postDataJSON();
    assert.equal(payload.membershipNumber, "BGM0000123");
    homeScanCount += 1;
    return route.fulfill({
      json: {
        result: "granted",
        granted: true,
        duplicate: false,
        scanId: "scan-home-browser",
        scannedAt: "2026-09-18T10:00:00.000Z",
        scannedBarcode: "BGM0000123",
        credentialKind: "member_number",
        cardStatus: "member_number",
        gym: { id: "bgm-browser-gym", name: "Browser Gym" },
        member: {
          id: member.id,
          memberNumber: "BGM0000123",
          fullName: "Existing Member",
          status: "active",
          membershipExpiry: "2027-12-31",
          enrollmentGymId: "bgm-browser-gym",
          enrollmentGymName: "Browser Gym",
          hasPhoto: true,
          photoRequired: false,
          photoUrl: null,
        },
      },
    });
  });

  await page.route("**/api/system/members/search?*", (route) => {
    const url = new URL(route.request().url());
    assert.ok(url.searchParams.has("status"));
    return route.fulfill({ json: { candidates: [member], hasMore: false } });
  });

  await page.route("**/api/system/members/applications", (route) =>
    route.fulfill({ json: { applications: activated ? [] : [queueApplication()] } })
  );

  await page.route(`**/api/system/members/applications/${applicationId}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      assert.equal(payload.action, "save_review");
      assert.equal(payload.membershipType, "single");
      assert.equal(payload.participants?.[0]?.idVerified, true);
      idVerified = true;
      return route.fulfill({ json: { ok: true, review: { applicationId } } });
    }
    return route.fulfill({ json: { application: applicationDetail() } });
  });

  await page.route("**/api/system/members/card/assign", (route) => {
    assert.equal(route.request().method(), "POST");
    const payload = route.request().postDataJSON();
    assert.deepEqual(payload, {
      applicationMemberId: participantId,
      barcode: "CARD-12345",
    });
    cardAssigned = true;
    return route.fulfill({
      json: {
        ok: true,
        reservation: {
          id: "credential-browser",
          applicationMemberId: participantId,
          barcodeValue: "CARD-12345",
          status: "reserved",
        },
      },
    });
  });

  await page.route(`**/api/system/members/applications/${applicationId}/discount`, (route) => {
    assert.equal(route.request().method(), "POST");
    const payload = route.request().postDataJSON();
    assert.deepEqual(payload, { code: "SAVE10" });
    return route.fulfill({
      json: {
        code: "SAVE10",
        percentage: 10,
        basePriceCents: 3000,
        discountAmountCents: 300,
        finalAmountCents: 2700,
        currency: "EUR",
        priceCatalogVersionId: "catalog-browser",
      },
    });
  });

  await page.route("**/api/system/members/enroll", (route) => {
    assert.equal(route.request().method(), "POST");
    const payload = route.request().postDataJSON();
    assert.equal(payload.action, "activate");
    assert.equal(payload.applicationId, applicationId);
    assert.equal(payload.paymentMethod, "cash");
    assert.equal(payload.paymentOtherText, "");
    assert.equal(payload.staffName, "Browser Staff");
    assert.equal(payload.discountCode, "SAVE10");
    activated = true;
    return route.fulfill({ json: { ok: true, activation: { applicationId } } });
  });

  await page.goto(origin + "/staff");
  await waitVisible(page.getByRole("heading", { name: "Browser Gym Reception", exact: true }));
  await waitVisible(page.getByRole("heading", { name: "READY TO SCAN", exact: true }));
  const homeScanner = page.getByPlaceholder("Barcode scanner input");
  await homeScanner.fill("BGM0000123");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await waitVisible(page.getByRole("heading", { name: "ACCESS GRANTED", exact: true }));
  await waitVisible(page.getByText("Scanned via BGM member number", { exact: true }));
  await page.getByRole("button", { name: "Close / Scan Next", exact: true }).click();
  await waitVisible(page.getByRole("heading", { name: "READY TO SCAN", exact: true }));
  assert.equal(homeScanCount, 1, "staff home must process a barcode without opening Reception");
  await waitVisible(page.getByRole("button", { name: "Members", exact: true }));
  await waitVisible(page.getByRole("button", { name: "New Member", exact: true }));
  await waitVisible(page.getByRole("link", { name: "Card / Reception", exact: true }));
  await waitVisible(page.getByRole("link", { name: "Sundries", exact: true }));
  await waitVisible(page.getByRole("link", { name: "Bar", exact: true }));
  assert.equal(await page.getByText("1 WAITING", { exact: true }).count() >= 1, true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "staff dashboard must fit tablet viewport");
  await page.screenshot({ path: artifacts + "/dashboard-1024.png", fullPage: true });

  await waitVisible(page.getByPlaceholder("Search name, member number, ID number, phone or email"));
  await page.getByPlaceholder("Search name, member number, ID number, phone or email").fill("123456M");
  await waitVisible(page.getByText("Existing Member", { exact: true }));
  await page.getByRole("button", { name: "ACTIVE", exact: true }).click();
  await waitVisible(page.getByText("Existing Member", { exact: true }));
  await page.getByRole("button", { name: "ALL", exact: true }).click();

  await page.getByText("Browser Queue Member", { exact: true }).click();
  await waitVisible(page.getByRole("heading", { name: "Review membership", exact: true }));
  await waitVisible(page.getByRole("button", { name: "SCAN CARD", exact: true }));
  await waitVisible(page.getByRole("button", { name: "PAYMENT RECEIVED", exact: true }));
  assert.equal(await page.getByRole("button", { name: "PAYMENT RECEIVED", exact: true }).isDisabled(), true);
  await page.screenshot({ path: artifacts + "/review-1024.png", fullPage: true });

  await page.getByLabel("ID / passport verified").check();
  assert.equal(
    await page.getByRole("button", { name: "PAYMENT RECEIVED", exact: true }).isDisabled(),
    true,
    "ID verification alone must not bypass the card requirement"
  );

  await page.getByRole("button", { name: "SCAN CARD", exact: true }).click();
  await waitVisible(page.getByPlaceholder("Scanner input", { exact: true }));
  await page.getByRole("button", { name: /Enter card manually/i }).click();
  await waitVisible(page.getByPlaceholder("Enter card barcode manually"));
  await page.getByPlaceholder("Enter card barcode manually").fill("CARD-12345");
  await page.getByRole("button", { name: "Confirm card", exact: true }).click();
  await page.getByText("CARD ASSIGNED ✓", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await page.getByRole("button", { name: "PAYMENT RECEIVED", exact: true }).isEnabled(), true);

  await page.getByRole("button", { name: "PAYMENT RECEIVED", exact: true }).click();
  await waitVisible(page.getByText("Base Price", { exact: true }));
  await page.getByPlaceholder("Enter Super Admin code").fill("SAVE10");
  await page.getByRole("button", { name: "Apply code", exact: true }).click();
  await waitVisible(page.getByText("10% · -€3.00", { exact: true }));
  await page.getByLabel("Cash").check();
  await waitVisible(page.getByPlaceholder("Payment Staff Name"));
  await page.getByPlaceholder("Payment Staff Name").fill("Browser Staff");
  await page.getByRole("button", { name: "PAYMENT RECEIVED — ACTIVATE", exact: true }).click();
  await waitVisible(page.getByRole("heading", { name: "MEMBERSHIP ACTIVE", exact: true }));
  await page.screenshot({ path: artifacts + "/success-1024.png", fullPage: true });

  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await page.getByText("0 WAITING", { exact: true }).count()) > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(await page.getByText("0 WAITING", { exact: true }).count() >= 1, true, "activated application must leave the waiting queue");
  assert.deepEqual(pageErrors, [], "staff dashboard must not raise browser errors");
  console.log("PASS staff dashboard browse → review → card → payment activation workflow");
} catch (error) {
  if (page) {
    await page.screenshot({ path: artifacts + "/failure.png", fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
