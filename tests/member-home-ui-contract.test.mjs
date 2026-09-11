import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const homePath = join(root, "components/home/SocialHome.tsx");
const toolsPath = join(root, "components/home/MemberHomePrimaryTools.tsx");
const pagePath = join(root, "app/page.tsx");
const shellPath = join(root, "components/ui/AppShell.tsx");
const navPath = join(root, "components/BottomNav.tsx");
const heroPath = join(root, "components/home/VisualHomeHero.tsx");
const heroAssetPath = join(root, "public/visuals/home-hero-duo.jpg");
const cardPath = join(root, "components/member/MemberCard.tsx");
const closestGymPath = join(root, "components/home/ClosestGymCard.tsx");

test("member home matches the approved mockup hierarchy", () => {
  const home = readFileSync(homePath, "utf8");

  assert.match(home, /data-home-layout=["']approved-mockup["']/);
  assert.match(home, /<VisualHomeHero/);
  assert.match(home, /<MemberCard\s+variant=["']home["']/);
  assert.match(home, /<MemberHomePrimaryTools/);
  assert.match(home, /<ClosestGymCard/);
  assert.doesNotMatch(home, /VisualQuickLinks/);
});

test("approved hero keeps the exact BGM copy and uses the visible duo artwork", () => {
  const hero = readFileSync(heroPath, "utf8");

  assert.match(hero, /\/brand\/bgm-logo-white-horizontal\.png/);
  assert.match(hero, /More\s*<br\s*\/?>\s*Than Gyms|More Than Gyms/s);
  assert.match(hero, /be the best\.\.\.beat the rest/i);
  assert.match(hero, /Show Card/);
  assert.match(hero, /Find Gyms/);
  assert.match(hero, /\/visuals\/home-hero-duo\.jpg/);
  assert.doesNotMatch(hero, /\/api\/home-hero-artwork/);
});

test("approved duo hero is a detailed static image, not a degraded fallback", () => {
  assert.equal(existsSync(heroAssetPath), true, "duo hero artwork must exist");
  assert.ok(
    statSync(heroAssetPath).size > 60_000,
    "duo hero artwork must retain enough source detail to show both people clearly"
  );
});

test("primary and secondary home tools use the approved 3 plus 4 tile layout", () => {
  assert.equal(existsSync(toolsPath), true, "primary member tools component must exist");
  const tools = readFileSync(toolsPath, "utf8");

  assert.match(tools, /grid-cols-3/);
  assert.match(tools, /AI Trainer/i);
  assert.match(tools, /\/trainer/);
  assert.match(tools, /Mobility\s*&\s*Stretch/i);
  assert.match(tools, /\/mobility-stretch/);
  assert.match(tools, /Progress/i);
  assert.match(tools, /\/progress/);
  assert.match(tools, /grid-cols-4/);
  assert.match(tools, /Passport/);
  assert.match(tools, /Story Creator/);
  assert.match(tools, /Gyms/);
  assert.match(tools, /Announcements/);
});

test("home membership card is the compact strip with the round BGM mark", () => {
  const card = readFileSync(cardPath, "utf8");

  assert.match(card, /data-home-membership=["']compact-strip["']/);
  assert.match(card, /fetch\(["']\/api\/member\/card["']/);
  assert.match(card, /<MemberBarcode\s+memberNumber=\{cardBarcode\}/);
  assert.match(card, /setFlipped/);
  assert.match(card, /src=["']\/bgm-logo\.png["']/);
  assert.doesNotMatch(card, /src=["']\/brand\/bgm-logo-white-horizontal\.png["']/);
});

test("nearest gym keeps location behavior while using the compact mockup row", () => {
  const closestGym = readFileSync(closestGymPath, "utf8");

  assert.match(closestGym, /data-home-nearest=["']compact-row["']/);
  assert.match(closestGym, /fetch\(["']\/api\/gyms["']/);
  assert.match(closestGym, /navigator\.geolocation\.getCurrentPosition/);
});

test("member home uses the approved light five-item bottom navigation", () => {
  const page = readFileSync(pagePath, "utf8");
  const shell = readFileSync(shellPath, "utf8");
  const nav = readFileSync(navPath, "utf8");

  assert.match(page, /navVariant=["']light["']/);
  assert.match(page, /useTopBar=\{false\}/);
  assert.match(shell, /<BottomNav\s+variant=\{navVariant\}/);
  assert.match(nav, /Home/);
  assert.match(nav, /Gyms/);
  assert.match(nav, /Workouts/);
  assert.match(nav, /Community/);
  assert.match(nav, /Profile/);
});
