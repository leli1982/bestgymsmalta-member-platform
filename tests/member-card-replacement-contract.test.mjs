import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const routePath = join(root, "app/api/system/members/card/replace/route.ts");
const componentPath = join(root, "components/staff/IssueNewCardPanel.tsx");
const pagePath = join(root, "app/staff/reception/issue-card/page.tsx");
const receptionPath = join(root, "app/staff/reception/page.tsx");
const migrationPath = join(root, "supabase/migrations/20260910_114000_card_replacement.sql");

test("standalone issue-new-card workflow exists and is reachable from reception", () => {
  assert.equal(existsSync(componentPath), true, "IssueNewCardPanel must exist");
  assert.equal(existsSync(pagePath), true, "issue-card route must exist");
  assert.equal(existsSync(receptionPath), true, "reception page must exist");
  const component = readFileSync(componentPath, "utf8");
  const page = readFileSync(pagePath, "utf8");
  const reception = readFileSync(receptionPath, "utf8");
  assert.match(component, /\/api\/system\/members\/search\?q=/);
  assert.match(component, /Issue New Card/);
  assert.match(component, /lost|stolen|damaged|other/);
  assert.match(component, /\/api\/system\/members\/card\/replace/);
  assert.match(component, /Permanent BGM no\./);
  assert.doesNotMatch(component, /setMember\(\{ \.\.\.member, memberNumber: data\.replacement\.newBarcode \}\)/);
  assert.match(page, /IssueNewCardPanel/);
  assert.match(reception, /\/staff\/reception\/issue-card/);
});

test("replacement API requires the dedicated permission and exact replacement inputs", () => {
  assert.equal(existsSync(routePath), true, "replacement API must exist");
  const route = readFileSync(routePath, "utf8");
  assert.match(route, /requireSystemPermission\(request,\s*"cards\.replace"\)/);
  assert.match(route, /normalizeBarcodePayload/);
  assert.match(route, /lost/);
  assert.match(route, /stolen/);
  assert.match(route, /damaged/);
  assert.match(route, /other/);
  assert.match(route, /bgm_replace_member_card/);
});

test("replacement transaction changes only the card credential and compatibility barcode", () => {
  assert.equal(existsSync(migrationPath), true, "replacement migration must exist");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /create or replace function public\.bgm_replace_member_card/);
  assert.match(migration, /for update/);
  assert.match(migration, /status = 'retired'/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /member_number = v_new_barcode/);
  assert.match(migration, /issue_new_card/);
  assert.doesNotMatch(migration, /membership_expiry\s*=/);
  assert.doesNotMatch(migration, /enrollment_date\s*=/);
  assert.doesNotMatch(migration, /membership_period\s*=/);
});


test("Super Admin member editor exposes the same audited physical-card replacement flow", () => {
  const editor = readFileSync(join(root, "components/staff/SuperAdminMemberEditor.tsx"), "utf8");
  const detailRoute = readFileSync(join(root, "app/api/system/admin/members/[memberId]/route.ts"), "utf8");
  assert.match(editor, /Physical card/);
  assert.match(editor, /Replace \/ reassign physical card/);
  assert.match(editor, /\/api\/system\/members\/card\/replace/);
  assert.match(editor, /data-bgm-scan-input="true"/);
  assert.match(editor, /The permanent BGM member number never changes/);
  assert.match(detailRoute, /bgm_legacy_card_claims/);
  assert.match(detailRoute, /activeCardSource/);
  assert.match(detailRoute, /legacy_scan3/);
});
