import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3100";
const artifacts = "test-artifacts/member-ui";
const member = {
  id: "browser-engagement-member",
  username: "engagement-member",
  memberNumber: "BGM1005",
  fullName: "Engagement Test Member",
  email: "engagement@example.test",
  status: "active",
  membershipExpiry: "9999-12-31",
};
const activeAccess = {
  state: "active",
  daysUntilExpiry: 9999,
  graceDaysRemaining: 0,
  reminderDue: false,
};

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => { serverOutput = (serverOutput + data).slice(-6000); });
}

let browser;
const pageErrors = [];

async function waitForServer() {
  for (let attempt = 0; ; attempt += 1) {
    try {
      if ((await fetch(origin + "/more")).ok) return;
    } catch {}
    if (attempt > 100 || server.exitCode !== null) {
      throw new Error("Next.js did not start: " + serverOutput);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function seedMemberContext(context) {
  await context.addInitScript(({ member }) => {
    sessionStorage.setItem("bgmSplashShown", "true");
    localStorage.setItem("bgmMemberSession", JSON.stringify(member));
    localStorage.setItem("bgmOnboardingComplete:" + member.id, "true");
  }, { member });
}

async function mockMemberApis(page, preferencesState) {
  await page.route("**/api/member/auth/session", (route) => route.fulfill({
    json: { member, access: activeAccess },
  }));

  await page.route("**/api/member/notification-preferences", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ json: { preferences: preferencesState.value } });
    }
    if (method === "PATCH") {
      const patch = route.request().postDataJSON();
      preferencesState.patches.push(patch);
      preferencesState.value = { ...preferencesState.value, ...patch };
      return route.fulfill({ json: { preferences: preferencesState.value } });
    }
    return route.fulfill({ status: 405, json: { error: "Method not allowed in test." } });
  });
}

async function waitForCount(items, count) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (items.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Expected ${count} captured requests, received ${items.length}.`);
}

try {
  await mkdir(artifacts, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  // Subscribed desktop/device state: verify account categories, local test and device-only disable.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await seedMemberContext(context);
    await context.addInitScript(() => {
      const subscription = {
        endpoint: "https://push.example.test/member-engagement-device",
        toJSON() {
          return {
            endpoint: this.endpoint,
            keys: { p256dh: "test-p256dh", auth: "test-auth" },
          };
        },
        async unsubscribe() {
          window.__bgmPushTest.unsubscribed = true;
          return true;
        },
      };
      const registration = {
        active: {},
        installing: null,
        waiting: null,
        pushManager: {
          async getSubscription() { return subscription; },
          async subscribe() { return subscription; },
        },
        async showNotification(title, options) {
          window.__bgmPushTest.localNotification = { title, options };
        },
      };
      window.__bgmPushTest = { unsubscribed: false, localNotification: null };
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: {
          permission: "granted",
          async requestPermission() { return "granted"; },
        },
      });
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: function PushManager() {},
      });
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          async getRegistration() { return registration; },
          async register() { return registration; },
        },
      });
    });

    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const preferencesState = {
      value: { criticalEnabled: true, motivationalEnabled: true, updatedAt: null },
      patches: [],
    };
    const deletes = [];
    await mockMemberApis(page, preferencesState);
    await page.route("**/api/member/push", async (route) => {
      if (route.request().method() === "DELETE") {
        deletes.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: { publicKey: "unused-in-subscribed-fixture" },
      });
    });

    await page.goto(origin + "/more");
    await page.getByRole("heading", { name: "App notifications" }).waitFor();
    await page.getByText("THIS DEVICE ENABLED", { exact: true }).waitFor();
    await page.getByText("Permission: Granted", { exact: true }).waitFor();

    const critical = page.getByRole("checkbox", { name: "Membership & account reminders" });
    const motivational = page.getByRole("checkbox", { name: "Motivation & streaks" });
    assert.equal(await critical.isChecked(), true);
    assert.equal(await motivational.isChecked(), true);

    await motivational.click();
    await waitForCount(preferencesState.patches, 1);
    assert.deepEqual(preferencesState.patches[0], { motivationalEnabled: false });
    assert.equal(await motivational.isChecked(), false);

    await critical.click();
    await waitForCount(preferencesState.patches, 2);
    assert.deepEqual(preferencesState.patches[1], { criticalEnabled: false });
    assert.equal(await critical.isChecked(), false);

    await page.getByRole("button", { name: "Test notification on this device" }).click();
    await page.getByText("Local test notification requested on this device.", { exact: true }).waitFor();
    const localNotification = await page.evaluate(() => window.__bgmPushTest.localNotification);
    assert.equal(localNotification?.title, "BestGymsMalta TEST");

    await page.screenshot({ path: artifacts + "/notifications-subscribed-390.png", fullPage: true });

    await page.getByRole("button", { name: "Disable notifications on this device" }).click();
    await page.getByText("Notifications are disabled on this device only.", { exact: true }).waitFor();
    await waitForCount(deletes, 1);
    assert.deepEqual(deletes[0], { endpoint: "https://push.example.test/member-engagement-device" });
    assert.equal(await page.evaluate(() => window.__bgmPushTest.unsubscribed), true);
    await page.getByRole("button", { name: "Enable notifications on this device" }).waitFor();

    console.log("PASS subscribed member device, category toggles, local test and device-only disable");
    await context.close();
  }

  // iPhone/iPad outside an installed Home Screen PWA: unsupported APIs must show install guidance.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await seedMemberContext(context);
    await context.addInitScript(() => {
      const removeFromChain = (root, key) => {
        let current = root;
        while (current) {
          try { Reflect.deleteProperty(current, key); } catch {}
          current = Object.getPrototypeOf(current);
        }
      };
      removeFromChain(window, "Notification");
      removeFromChain(window, "PushManager");
      removeFromChain(navigator, "serviceWorker");

      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query === "(display-mode: standalone)") {
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; },
          };
        }
        return nativeMatchMedia(query);
      };
    });

    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const preferencesState = {
      value: { criticalEnabled: true, motivationalEnabled: true, updatedAt: null },
      patches: [],
    };
    await mockMemberApis(page, preferencesState);

    await page.goto(origin + "/more");
    await page.getByRole("heading", { name: "App notifications" }).waitFor();
    await page.getByText("PUSH UNSUPPORTED", { exact: true }).waitFor();
    await page.getByText(/On iPhone or iPad, install BestGymsMalta to your Home Screen first/).waitFor();
    assert.equal(await page.getByRole("button", { name: "Enable notifications on this device" }).count(), 0);
    assert.equal(
      await page.evaluate(() => !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)),
      true,
      "unsupported fixture must actually remove at least one Push API",
    );

    await page.screenshot({ path: artifacts + "/notifications-ios-home-screen-guidance-390.png", fullPage: true });
    console.log("PASS iPhone/iPad Home Screen PWA guidance when Push APIs are unavailable");
    await context.close();
  }

  assert.deepEqual(pageErrors, [], "member engagement notification UI must not raise browser errors");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
