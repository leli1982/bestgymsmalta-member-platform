import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3121";
const artifactDir = "test-artifacts/super-admin-management";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3121", "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { logs = (logs + chunk).slice(-3500); });
}
let browser;
try {
  await mkdir(artifactDir, { recursive: true });
  for (let n = 0; ; n++) {
    try { if ((await fetch(origin + "/staff/admin")).ok) break; } catch {}
    if (n > 120 || server.exitCode !== null) throw new Error("Next.js startup failed: " + logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1350, height: 920 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  const gym = (id, name, slug, status, provisioned = true) => ({
    id, name, shortName: name, publicEnrollmentSlug: slug,
    staffPath: "/staff/" + slug, joinPath: "/join/" + slug,
    status, staffProvisioned: provisioned, staffUsername: provisioned ? slug + "fitness" : null,
    staffSystemUserId: provisioned ? "staff-" + slug : null, staffActive: provisioned && status === "active",
    city: "", address: "", openingHours: "", phone: "", email: "", logo: "",
    latitude: "", longitude: "", virtualTourUrl: "", accentColor: "#fcb415",
    facilities: [], classes: [], featuredEquipment: [], notes: "", sortOrder: 1,
  });
  let gyms = [
    gym("bgm-birkirkara", "Birkirkara Fitness", "birkirkara", "active"),
    gym("bgm-marsa", "Marsa Fitness", "marsa", "active"),
    gym("bgm-gozo", "Gozo", "gozo", "coming_soon", false),
  ];
  let users = [
    { id: "admin-root", gymId: null, username: "rootadmin", displayName: "Root Admin",
      gymName: null, isSuperAdmin: true, active: true, permissions: [], lastLoginAt: null },
    { id: "admin-second", gymId: null, username: "secondadmin", displayName: "Second Admin",
      gymName: null, isSuperAdmin: true, active: true, permissions: [], lastLoginAt: null },
    { id: "staff-birkirkara", gymId: "bgm-birkirkara", username: "birkirkarafitness",
      gymName: "Birkirkara Fitness", displayName: "Birkirkara Staff",
      isSuperAdmin: false, active: true, permissions: [], lastLoginAt: null },
    { id: "staff-marsa", gymId: "bgm-marsa", username: "marsafitness",
      gymName: "Marsa Fitness", displayName: "Marsa Staff",
      isSuperAdmin: false, active: true, permissions: [], lastLoginAt: null },
  ];
  const credentials = [];
  const provisioned = [];
  await context.route("**/api/system/auth", (route) => route.fulfill({
    json: { authenticated: true, user: { id: "admin-root", gymId: null,
      displayName: "Root Admin", isSuperAdmin: true, permissions: [] } },
  }));
  await context.route("**/api/admin/gyms", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { gyms } });
    const body = route.request().postDataJSON();
    if (body.mode === "create") {
      assert.equal(body.gym.name, "Naxxar");
      assert.equal(body.gym.shortName, "NX");
      assert.equal(body.gym.status, "active");
      assert.equal(body.staffPassword, "browser-test-password");
      provisioned.push(body);
      const created = { ...gym("bgm-naxxar", "Naxxar", "naxxar", "active"),
        shortName: "NX", staffSystemUserId: "staff-naxxar", staffUsername: "naxxarfitness" };
      gyms = [...gyms, created];
      users = [...users, { id: "staff-naxxar", gymId: created.id, username: "naxxarfitness",
        gymName: "Naxxar", displayName: "NX Staff", isSuperAdmin: false,
        active: true, permissions: [], lastLoginAt: null }];
      return route.fulfill({ status: 201, json: { gym: created,
        joinPath: "/join/naxxar", staffPath: "/staff/naxxar" } });
    }
    if (body.mode === "update") {
      gyms = gyms.map((entry) => entry.id === body.gym.id ? { ...entry, ...body.gym } : entry);
      return route.fulfill({ json: { gym: body.gym,
        joinPath: body.gym.joinPath, staffPath: body.gym.staffPath } });
    }
    return route.fulfill({ status: 409, json: { error: "Gym has staff or historical membership records." } });
  });
  await context.route("**/api/admin/system-users", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { users } });
    const body = route.request().postDataJSON();
    if (route.request().method() === "POST") {
      credentials.push({ kind: "create", ...body });
      const created = { id: "admin-third", gymId: body.gymId, gymName: null,
        username: body.username, displayName: body.displayName,
        isSuperAdmin: body.isSuperAdmin, active: true, permissions: [], lastLoginAt: null };
      users = [...users, created];
      return route.fulfill({ status: 201, json: { user: created } });
    }
    assert.equal(route.request().method(), "PATCH");
    credentials.push({ kind: "update", ...body });
    users = users.map((user) => user.id === body.id ? { ...user,
      username: body.username || user.username, displayName: body.displayName || user.displayName,
      active: body.active ?? user.active } : user);
    return route.fulfill({ json: { user: users.find((user) => user.id === body.id) } });
  });
  await context.route("**/api/system/members/search?**", (route) =>
    route.fulfill({ json: { candidates: [], hasMore: false } }));
  await context.route("**/api/system/members/applications", (route) =>
    route.fulfill({ json: { applications: [] } }));

  await page.goto(origin + "/staff/admin");
  await page.getByRole("heading", { name: "Super Admin", exact: true }).waitFor({ state: "visible" });
  const headings = await page.locator("section[aria-label] > div > h2").allTextContents();
  assert.deepEqual(headings, ["Operations", "Management", "Membership Tools"],
    "Occasional membership tasks must appear after daily operations and management");
  for (const label of [
    "Gym locations", "Super Admin accounts", "Staff Portal logins",
    "Members", "New membership", "Renew", "Waiting", "Reception tools",
  ]) {
    await page.getByRole("link", { name: new RegExp(label) }).first().waitFor({ state: "visible" });
  }

  await page.goto(origin + "/staff/admin/gyms");
  await page.getByRole("heading", { name: "Gym locations", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /Add new gym/ }).click();
  await page.getByRole("textbox", { name: "Gym name" }).fill("Naxxar");
  await page.getByRole("textbox", { name: "Gym short name" }).fill("NX");
  await page.getByText(origin + "/staff/naxxar", { exact: true }).waitFor();
  await page.getByText(origin + "/join/naxxar", { exact: true }).waitFor();
  assert.equal(await page.getByText(origin + "/staff/nx", { exact: true }).count(), 0,
    "Short display name must not replace the gym's URL slug");
  await page.getByLabel("Gym Staff password").fill("browser-test-password");
  await page.getByRole("button", { name: "Add gym and create addresses" }).click();
  await page.getByRole("status").filter({ hasText: "Gym saved." }).waitFor({ state: "visible" });
  assert.equal(provisioned.length, 1, "Gym provisioning should create one shared Staff Portal account");
  await page.getByRole("link", { name: origin + "/staff/naxxar" }).waitFor({ state: "visible" });
  await page.getByRole("link", { name: origin + "/join/naxxar" }).waitFor({ state: "visible" });
  await page.screenshot({ path: artifactDir + "/gyms-and-generated-addresses.png", fullPage: true });

  // An unprovisioned coming-soon gym must request a password instead of attempting a broken activation.
  await page.getByRole("button", { name: "Activate" }).click();
  await page.getByRole("status").filter({ hasText: "Set a Staff Portal password" }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("textbox", { name: "Gym name" }).inputValue(), "Gozo");
  assert.equal(await page.getByRole("combobox", { name: "Gym status" }).inputValue(), "active");
  await page.getByLabel("Gym Staff password").waitFor({ state: "visible" });

  await page.goto(origin + "/staff/admin/super-admins");
  await page.getByRole("heading", { name: "Super Admin accounts", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("article").filter({ hasText: "Root Admin" }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("article").filter({ hasText: "Birkirkara Staff" }).count(), 0,
    "Super Admin accounts must not be mixed with gym Staff logins");
  await page.getByRole("textbox", { name: "New login display name" }).fill("New Admin");
  await page.getByRole("textbox", { name: "New login username" }).fill("newadmin");
  await page.getByLabel("New login password").fill("browser-admin-pass");
  await page.getByRole("button", { name: "Create login" }).click();
  await page.getByRole("status").filter({ hasText: "login created" }).waitFor({ state: "visible" });
  assert.equal(credentials.find((entry) => entry.kind === "create")?.isSuperAdmin, true);
  const root = page.getByRole("article").filter({ hasText: "Root Admin" });
  await root.getByLabel("rootadmin new password").fill("browser-admin-reset");
  await root.getByRole("button", { name: "Change password" }).click();
  await page.getByRole("status").filter({ hasText: "login updated" }).waitFor({ state: "visible" });
  assert.equal(credentials.some((entry) => entry.kind === "update" &&
    entry.id === "admin-root" && entry.password === "browser-admin-reset"), true,
  "Super Admin must be able to reset another management password");

  await page.goto(origin + "/staff/admin/staff-logins?gymId=bgm-birkirkara");
  await page.getByRole("heading", { name: "Staff Portal logins", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("article").filter({ hasText: "Birkirkara Staff" }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("article").count(), 1, "Gym link should open the matching staff login");
  const staff = page.getByRole("article").filter({ hasText: "Birkirkara Staff" });
  await staff.getByLabel("birkirkarafitness edit username").fill("birkirkara-manager");
  await staff.getByRole("button", { name: "Save details" }).click();
  await page.getByRole("status").filter({ hasText: "login updated" }).waitFor({ state: "visible" });
  assert.equal(credentials.some((entry) => entry.kind === "update" &&
    entry.id === "staff-birkirkara" && entry.username === "birkirkara-manager"), true);
  const updatedStaff = page.getByRole("article").filter({ hasText: "Birkirkara Staff" });
  await updatedStaff.getByLabel("birkirkara-manager new password").fill("browser-staff-reset");
  await updatedStaff.getByRole("button", { name: "Change password" }).click();
  await page.getByRole("status").filter({ hasText: "login updated" }).waitFor({ state: "visible" });
  assert.equal(credentials.some((entry) => entry.kind === "update" &&
    entry.id === "staff-birkirkara" && entry.password === "browser-staff-reset"), true,
  "Staff Portal passwords must be resettable per gym");
  await page.screenshot({ path: artifactDir + "/gym-staff-login-management.png", fullPage: true });

  await page.goto(origin + "/staff/admin/membership-tools?tool=members");
  await page.getByRole("heading", { name: "Membership Tools" }).waitFor({ state: "visible" });
  await page.goto(origin + "/staff/admin/membership-tools?tool=waiting");
  await page.getByRole("heading", { name: "Membership Tools" }).waitFor({ state: "visible" });
  assert.deepEqual(errors, [], "Super Admin management must not cause browser errors");
  console.log("PASS Super Admin navigation, isolated membership tools, gym addresses, activation passwords and management of super/staff logins");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
