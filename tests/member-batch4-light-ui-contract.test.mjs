// Batch 4 contract: light account, onboarding, dashboard and community surfaces while preserving auth/onboarding behavior.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const memberLoginRoutePath = join(root, "app/member-login/page.tsx");
const memberLoginPath = join(root, "components/member-auth/MemberLoginPage.tsx");
const resetRoutePath = join(root, "app/reset-password/page.tsx");
const resetPath = join(root, "components/member-auth/ResetPasswordPage.tsx");
const onboardingPath = join(root, "app/onboarding/page.tsx");
const firstTimePath = join(root, "components/onboarding/FirstTimeOnboarding.tsx");
const dashboardPath = join(root, "app/dashboard/page.tsx");
const showcasePath = join(root, "app/member-showcase/page.tsx");
const legacyLoginPath = join(root, "app/login/page.tsx");

test("Batch 4 account routes use the approved light member shell", () => {
  const memberLoginRoute = readFileSync(memberLoginRoutePath, "utf8");
  const resetRoute = readFileSync(resetRoutePath, "utf8");

  assert.match(memberLoginRoute, /<AppShell\s+theme=["']light["']/);
  assert.match(resetRoute, /<AppShell\s+theme=["']light["']/);
});

test("Member Login becomes light while preserving login, activation, reset and session behavior", () => {
  const source = readFileSync(memberLoginPath, "utf8");

  assert.match(source, /data-member-surface=["']member-account-light["']/);
  assert.match(source, /bg-white/);
  assert.match(source, /border-zinc-200/);
  assert.match(source, /text-zinc-950/);
  assert.match(source, /\/api\/member\/auth\/session/);
  assert.match(source, /\/api\/member\/auth\/login/);
  assert.match(source, /\/api\/member\/auth\/register/);
  assert.match(source, /\/api\/member\/auth\/forgot-password/);
  assert.match(source, /returnTo/);
  assert.match(source, /clearSavedMember\(\)/);
});

test("Reset Password uses a light secure card and preserves reset token behavior", () => {
  const source = readFileSync(resetPath, "utf8");

  assert.match(source, /data-member-surface=["']reset-password-light["']/);
  assert.match(source, /\/api\/member\/auth\/reset-password/);
  assert.match(source, /token/);
  assert.match(source, /bg-white/);
  assert.match(source, /border-zinc-200/);
  assert.match(source, /text-zinc-950/);
});

test("First-time onboarding becomes a light sheet without changing per-member completion logic", () => {
  const source = readFileSync(firstTimePath, "utf8");

  assert.match(source, /data-onboarding-surface=["']first-time-light["']/);
  assert.match(source, /bgmOnboardingComplete:\$\{savedMember\.id\}/);
  assert.match(source, /localStorage\.getItem/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /Skip/);
  assert.match(source, /Next/);
  assert.match(source, /Start/);
  assert.match(source, /bg-white/);
});

test("Standalone onboarding is light and no longer advertises NFC", () => {
  const source = readFileSync(onboardingPath, "utf8");

  assert.match(source, /data-member-surface=["']onboarding-light["']/);
  assert.match(source, /digital membership card/i);
  assert.match(source, /bg-\[#f6f6f6\]/);
  assert.match(source, /bg-white/);
  assert.doesNotMatch(source, /NFC-ready/i);
});

test("Dashboard and Community use the approved light shell while keeping their existing data/components", () => {
  const dashboard = readFileSync(dashboardPath, "utf8");
  const showcase = readFileSync(showcasePath, "utf8");

  assert.match(dashboard, /<AppShell\s+theme=["']light["']/);
  assert.match(dashboard, /data-member-surface=["']dashboard-light["']/);
  assert.match(dashboard, /currentMember/);
  assert.match(dashboard, /bg-white/);

  assert.match(showcase, /<AppShell\s+theme=["']light["']/);
  assert.match(showcase, /data-member-surface=["']community-light["']/);
  assert.match(showcase, /<MemberCard\s*\/>/);
  assert.match(showcase, /bg-white/);
});

test("Legacy login receives the light BGM entry treatment without changing its destination", () => {
  const source = readFileSync(legacyLoginPath, "utf8");

  assert.match(source, /data-member-surface=["']legacy-login-light["']/);
  assert.match(source, /href=["']\/["']/);
  assert.match(source, /Enter App/);
  assert.match(source, /bg-\[#f6f6f6\]/);
  assert.match(source, /bg-white/);
});
