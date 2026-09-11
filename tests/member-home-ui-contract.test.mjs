import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const homePath = join(root, "components/home/SocialHome.tsx");
const toolsPath = join(root, "components/home/MemberHomePrimaryTools.tsx");
const pagePath = join(root, "app/page.tsx");
const shellPath = join(root, "components/ui/AppShell.tsx");
const navPath = join(root, "components/BottomNav.tsx");
const heroPath = join(root, "components/home/VisualHomeHero.tsx");
const cardPath = join(root, "components/member/MemberCard.tsx");
const closestGymPath = join(root, "components/home/ClosestGymCard.tsx");

test("member home uses the approved hybrid dashboard hierarchy", () => {
  const home = readFileSync(homePath, "utf8");

  assert.match(home, /MemberHomePrimaryTools/);
  assert.match(home, /MemberCard/);
  assert.match(home, /ClosestGymCard/);
  assert.match(home, /HomeAnnouncementCard/);
  assert.doesNotMatch(home, /VisualQuickLinks/);
  assert.match(home, /bg-\[#f[457][f57][f57][f57]\]|bg-zinc-50|bg-stone-50/i);
});

test("AI trainer, mobility and progress are prominent first-class home tools", () => {
  assert.equal(existsSync(toolsPath), true, "primary member tools component must exist");
  const tools = readFileSync(toolsPath, "utf8");

  assert.match(tools, /AI Trainer/i);
  assert.match(tools, /\/trainer/);
  assert.match(tools, /Mobility\s*&\s*Stretch/i);
  assert.match(tools, /\/mobility-stretch/);
  assert.match(tools, /Progress/i);
  assert.match(tools, /\/progress/);
});

test("only the member home opts into the light navigation treatment", () => {
  const page = readFileSync(pagePath, "utf8");
  const shell = readFileSync(shellPath, "utf8");
  const nav = readFileSync(navPath, "utf8");

  assert.match(page, /navVariant=["']light["']/);
  assert.match(shell, /navVariant/);
  assert.match(shell, /<BottomNav\s+variant=\{navVariant\}/);
  assert.match(nav, /variant.*light/s);
});

test("home redesign preserves card and nearest-gym functional contracts", () => {
  const card = readFileSync(cardPath, "utf8");
  const closestGym = readFileSync(closestGymPath, "utf8");

  assert.match(card, /fetch\(["']\/api\/member\/card["']/);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{cardBarcode\}/);
  assert.match(card, /setFlipped/);
  assert.match(closestGym, /fetch\(["']\/api\/gyms["']/);
  assert.match(closestGym, /navigator\.geolocation\.getCurrentPosition/);
});

test("home hero uses the official BestGymsMalta white logo asset", () => {
  const hero = readFileSync(heroPath, "utf8");
  assert.match(hero, /\/brand\/bgm-logo-white-horizontal\.png/);
});
