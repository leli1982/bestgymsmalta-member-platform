import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function requiredSource(path) {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, "utf8");
}

test("membership theme has one shared Regular Student Couples colour mapping", () => {
  const source = requiredSource("lib/membershipTheme.ts");
  assert.match(source, /single:[\s\S]*label:\s*"Regular"[\s\S]*#(?:0{6}|[0-1]{6})/i);
  assert.match(source, /student:[\s\S]*label:\s*"Student"[\s\S]*#[0-9A-Fa-f]{6}/);
  assert.match(source, /couples:[\s\S]*label:\s*"Couples"[\s\S]*#[0-9A-Fa-f]{6}/);
  assert.match(source, /resolveMembershipTheme/);
  assert.match(source, /fallback/i);
});

test("member card profile exposes current membership type and renders shared theme", () => {
  const session = requiredSource("lib/memberSession.ts");
  const route = requiredSource("app/api/member/card/route.ts");
  const card = requiredSource("components/member/MemberCard.tsx");

  assert.match(session, /membershipType\?:\s*"single"\s*\|\s*"student"\s*\|\s*"couples"\s*\|\s*null/);
  assert.match(route, /bgm_membership_members/);
  assert.match(route, /bgm_memberships/);
  assert.match(route, /membership_type/);
  assert.match(card, /resolveMembershipTheme/);
  assert.match(card, /member\.membershipType/);
});

test("Google Wallet projection carries membership type for later visual theming", () => {
  const core = requiredSource("lib/googleWalletCore.ts");
  const sync = requiredSource("lib/googleWalletSync.ts");

  assert.match(core, /membershipType:\s*"single"\s*\|\s*"student"\s*\|\s*"couples"\s*\|\s*null/);
  assert.match(core, /theme:/);
  assert.match(core, /resolveMembershipTheme/);
  assert.match(sync, /bgm_membership_members/);
  assert.match(sync, /bgm_memberships/);
  assert.match(sync, /membership_type/);
});
