import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");

test("member welcome-image default and foreground remain intact", () => {
  const hero = read("components/home/VisualHomeHero.tsx");
  const config = read("lib/memberDashboardHero.ts");
  assert.match(config, /MEMBER_HERO_DEFAULT\s*=\s*["']\/visuals\/home-hero-duo\.jpg["']/);
  assert.match(hero, /\/api\/member\/home-hero/);
  assert.match(hero, /heroImageUrl/);
  for (const originalForeground of ["Welcome back,", "Show Card", "Find Gyms", "More", "Than Gyms", "bgm-logo.png"]) {
    assert.ok(hero.includes(originalForeground), originalForeground);
  }
});

test("public settings read has no member data or mutation", () => {
  const publicApi = read("app/api/member/home-hero/route.ts");
  assert.match(publicApi, /export async function GET/);
  assert.doesNotMatch(publicApi, /export async function POST|export async function DELETE/);
  assert.match(publicApi, /no-store/);
});

test("upload and restore require Super Admin and validate image signature", () => {
  const admin = read("app/api/system/admin/member-home-hero/route.ts");
  const config = read("lib/memberDashboardHero.ts");
  assert.match(admin, /requireSuperAdmin\(request\)/);
  assert.match(admin, /request\.headers\.get\("origin"\)/);
  assert.match(admin, /validMemberHeroImage/);
  assert.match(config, /image\/jpeg/);
  assert.match(config, /image\/png/);
  assert.match(config, /image\/webp/);
  assert.match(config, /5 \* 1024 \* 1024/);
  assert.match(admin, /upsert\(/);
  assert.match(admin, /export async function DELETE/);
  assert.match(admin, /image_path: null/);
  assert.doesNotMatch(admin, /BGM_HU20|GOOGLE_WALLET|bgm_member_card_credentials/);
});

test("single safe image setting is isolated from member records and protected by RLS", () => {
  const schema = read("supabase/migrations/20261120_160000_member_dashboard_hero.sql");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.bgm_member_dashboard_hero/);
  assert.match(schema, /ENABLE ROW LEVEL SECURITY/);
  assert.match(schema, /REVOKE ALL ON TABLE.*FROM PUBLIC, anon, authenticated/);
  assert.match(schema, /GRANT SELECT, INSERT, UPDATE.*TO service_role/);
  assert.match(schema, /CHECK \(id = 1\)/);
  assert.doesNotMatch(schema, /\bDROP\b|\bTRUNCATE\b|\bDELETE\b|\bALTER TABLE public\.bgm_members\b/i);
});

test("only Super Admin can manage the dashboard image", () => {
  const nav = read("components/staff/SuperAdminHome.tsx");
  const page = read("app/staff/admin/member-dashboard-image/page.tsx");
  assert.match(nav, /href: "\/staff\/admin\/member-dashboard-image"/);
  assert.match(page, /session\?\.user\?\.isSuperAdmin/);
  assert.match(page, /Publish image & position/);
  assert.match(page, /Save image position/);
  assert.match(page, /Restore original image/);
  assert.match(page, /Preview — unpublished framing/);
});


test("dashboard image positioning is stored separately from uploaded artwork", () => {
  const schema = read("supabase/migrations/20261120_163000_member_dashboard_hero_position.sql");
  const model = read("lib/memberHeroPosition.ts");
  const admin = read("app/api/system/admin/member-home-hero/route.ts");
  const member = read("components/home/VisualHomeHero.tsx");
  const ui = read("app/staff/admin/member-dashboard-image/page.tsx");
  const lookup = read("lib/memberDashboardHero.ts");
  assert.match(schema, /ADD COLUMN IF NOT EXISTS position_x/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS position_y/);
  assert.match(schema, /BETWEEN 0 AND 100/);
  assert.match(model, /parseMemberHeroPosition/);
  assert.match(admin, /export async function PATCH/);
  assert.match(admin, /position_x: position.x/);
  assert.match(admin, /position_y: position.y/);
  assert.match(admin, /request\.headers\.get\("origin"\)/);
  assert.match(admin, /requireSuperAdmin\(request\)/);
  assert.match(lookup, /select\("image_path, position_x, position_y, updated_at"\)/);
  assert.match(member, /backgroundPosition/);
  assert.match(ui, /setPointerCapture/);
  assert.match(ui, /onPointerDown=\{pointerDown\}/);
  assert.match(ui, /overflowX/);
  assert.match(ui, /overflowY/);
  assert.match(ui, /method: "PATCH"/);
  assert.match(ui, /method: "POST"/);
  assert.match(ui, /Save image position/);
});
