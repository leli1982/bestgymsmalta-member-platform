import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3103";
const artifacts = "test-artifacts/print-a4";

const gymRules = `1. No towel, no training. Towels are to be used on benches and machines at all times.
2. No heavy banging when using free weights.
3. Weights are to be replaced after use.
4. No loud talking or shouting.
5. Proper clothing and gym shoes must be worn.
6. Hygiene is of high importance, shower if you smell.
7. The management is not responsible for any theft.
8. The management is not responsible for any injuries.
9. Membership is not transferable or frozen for any reason what so ever.
10. Membership is not refundable.
11. The management has the right to stop a membership if rules are not followed.`;

const legacyDeclaration = "I declare that the above details are correct and in the event of me being accepted, I undertake to abide by the Rules and Regulations set by the Management. I will not hold the Management responsible for the loss of or damage to my property/personal belongings within the confines of the BGM premises or grounds. I accept to exercise and use the facilities at my own risk with the prior consent of my doctor.";

const declarationSnapshot = {
  gym_rules: { versionNo: 1, body: gymRules },
  legacy_declaration: { versionNo: 1, body: legacyDeclaration },
  // Five moderately long paragraphs approximate the length and line count of the\n  // current published TEST privacy declaration, rather than testing short placeholder copy.\n  privacy: { versionNo: 1, body: Array(5).fill("I consent to the processing of my membership data for administration, access control and operational purposes in line with the accepted privacy notice.").join("\n") },
  health: { versionNo: 1, body: "I confirm that I am fit to exercise or have obtained appropriate medical advice, and I accept responsibility for training within my own limits." },
  guardian: { versionNo: 1, body: "I confirm that I am the parent or legal guardian, that I consent to this membership, and that I have attended reception to co-sign this application." },
};

function participant(order, overrides = {}) {
  return {
    id: `participant-${order}`,
    participantOrder: order,
    firstName: order === 1 ? "Alexandra-Maria" : "Christopher",
    lastName: "Long-Surname Example",
    addressLine1: "123 Example Residential Address",
    addressLine2: "Apartment 12, Example Court",
    town: "San Ġwann",
    postcode: "SGN 1234",
    idNumber: order === 1 ? "0123456M" : "0654321M",
    dateOfBirth: "1990-01-15",
    phone: "+356 7900 0000",
    email: `member${order}@example.com`,
    nextOfKin: "Example Next of Kin +356 7999 9999",
    memberId: `member-${order}`,
    memberNumber: `BGM000000${order}`,
    barcode: `BGM-CARD-000000${order}`,
    photoUrl: null,
    under18AtSubmission: false,
    guardianName: "",
    guardianIdNumber: "",
    guardianRelationship: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianAddress: "",
    idVerified: true,
    studentEligibilityVerified: false,
    guardianPresentVerified: false,
    guardianCosignVerified: false,
    ...overrides,
  };
}

function application(id, membershipType, participants) {
  return {
    id,
    applicationReference: `BGMAPP-${id.toUpperCase()}`,
    kind: "new",
    membershipType,
    durationKey: "1_year",
    startDate: "2026-09-18",
    expiryDate: "2027-09-18",
    status: "activated",
    submittedAt: "2026-09-18T07:30:00.000Z",
    paymentReceivedAt: "2026-09-18T08:00:00.000Z",
    activatedAt: "2026-09-18T08:00:00.000Z",
    applicationStaffName: "Browser Reception Staff",
    activationStaffName: "Browser Reception Staff",
    enrollmentGymId: "bgm-browser-gym",
    enrollmentGymName: "Browser Gym",
    basePriceCents: membershipType === "couples" ? 22000 : 12000,
    currency: "EUR",
    discountCode: "SAVE10",
    discountPercentage: 10,
    discountAmountCents: membershipType === "couples" ? 2200 : 1200,
    finalAmountCents: membershipType === "couples" ? 19800 : 10800,
    paymentMethod: "card",
    paymentOtherText: null,
    paymentStaffName: "Browser Reception Staff",
    declarationSnapshot,
    sameAddressVerified: membershipType === "couples",
    participants,
  };
}

const fixtures = {
  single: application("single", "single", [participant(1)]),
  student: application("student", "student", [
    participant(1, {
      dateOfBirth: "2009-01-15",
      under18AtSubmission: true,
      studentEligibilityVerified: true,
      guardianName: "Christopher Long Guardian Name",
      guardianIdNumber: "7654321M",
      guardianRelationship: "Parent / legal guardian",
      guardianPhone: "+356 7999 9999",
      guardianEmail: "guardian.long.email@example.com",
      guardianAddress: "123 Example Residential Address, San Ġwann SGN 1234",
      guardianPresentVerified: true,
      guardianCosignVerified: true,
    }),
  ]),
  couples: application("couples", "couples", [participant(1), participant(2)]),
};

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3103", "-H", "127.0.0.1"],
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
      if ((await fetch(origin + "/staff/applications/single/print")).ok) return;
    } catch {}
    if (attempt > 100 || server.exitCode !== null) {
      throw new Error("Next.js did not start: " + serverOutput);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function verifyFixture(context, key, expectedSheets) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/system/members/applications/*/print", (route) => {
    const match = route.request().url().match(/applications\/([^/]+)\/print/);
    const fixture = match ? fixtures[match[1]] : null;
    if (!fixture) {
      return route.fulfill({ status: 404, json: { error: "Fixture not found." } });
    }
    return route.fulfill({ json: { application: fixture } });
  });

  await page.goto(`${origin}/staff/applications/${key}/print`);
  const sheets = page.locator(".bgm-member-a4-sheet");
  await sheets.first().waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await sheets.count(), expectedSheets, `${key} sheet count`);

  const measurements = await sheets.evaluateAll((nodes) =>
    nodes.map((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      width: getComputedStyle(node).width,
      height: getComputedStyle(node).height,
      overflow: getComputedStyle(node).overflow,
    }))
  );

  for (const [index, measurement] of measurements.entries()) {
    assert.ok(
      measurement.scrollHeight <= measurement.clientHeight + 1,
      `${key} sheet ${index + 1} overflowed: ${measurement.scrollHeight} > ${measurement.clientHeight}`
    );
    assert.equal(measurement.overflow, "hidden");
  }

  if (key === "couples") assert.equal(measurements.length, 2);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const actualPdfPages = (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
  assert.equal(actualPdfPages, expectedSheets, `${key} Chromium PDF page count`);
  const printButton = page.getByRole("button", { name: /Print Membership/ });
  assert.equal(await printButton.isDisabled(), false, `${key} printable without hidden content`);
  await page.screenshot({ path: `${artifacts}/${key}.png`, fullPage: true });
  assert.deepEqual(pageErrors, [], `${key} print view must not raise browser errors`);
  await page.close();
}

async function verifyOverflowIsBlocked(context) {
  const page = await context.newPage();
  const oversized = application("oversized", "student", [participant(1, { under18AtSubmission: true })]);
  oversized.declarationSnapshot = {
    ...declarationSnapshot,
    privacy: { versionNo: 99, body: "Required privacy wording that must not be clipped or silently omitted. ".repeat(180) },
  };
  await page.route("**/api/system/members/applications/*/print", (route) =>
    route.fulfill({ json: { application: oversized } })
  );
  await page.goto(`${origin}/staff/applications/oversized/print`);
  await page.locator(".bgm-member-a4-sheet").waitFor({ state: "visible" });
  await page.getByRole("alert").getByText(/cannot fit on a single A4 page/).waitFor();
  assert.equal(await page.getByRole("button", { name: /Print Membership/ }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: /CONFIRM PRINTED/ }).count(), 0);
  await page.screenshot({ path: `${artifacts}/oversized-blocked.png`, fullPage: true });
  await page.close();
}

try {
  await mkdir(artifacts, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });

  await verifyFixture(context, "single", 1);
  await verifyFixture(context, "student", 1);
  await verifyFixture(context, "couples", 2);
  await verifyOverflowIsBlocked(context);

  console.log("PASS Chromium PDFs contain one A4 page per member; oversize agreements cannot be printed or confirmed");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
