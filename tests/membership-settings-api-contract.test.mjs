import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authSource = readFileSync("lib/systemAuth.ts", "utf8");
const routeSource = readFileSync("app/api/system/membership-settings/route.ts", "utf8");

test("system auth exposes a dedicated Super Admin guard", () => {
  assert.match(authSource, /export async function requireSuperAdmin\s*\(/);
  assert.match(authSource, /System login required\./);
  assert.match(authSource, /Super Admin access required\./);
  assert.match(authSource, /status:\s*401/);
  assert.match(authSource, /status:\s*403/);
});

test("membership settings API is Super Admin-only and supports the approved actions", () => {
  assert.match(routeSource, /requireSuperAdmin/);
  for (const action of [
    "save_price_draft",
    "publish_price_catalog",
    "save_declaration_draft",
    "publish_declaration",
    "save_discount_code",
    "set_discount_active",
  ]) {
    assert.match(routeSource, new RegExp(action));
  }
});

test("membership settings writes use server-side domain validation and publication RPCs", () => {
  assert.match(routeSource, /normalizeDiscountCode/);
  assert.match(routeSource, /validatePriceMatrix/);
  assert.match(routeSource, /bgm_publish_membership_price_catalog/);
  assert.match(routeSource, /bgm_publish_membership_declaration/);
  assert.doesNotMatch(routeSource, /body\.(?:successful_uses|successfulUses)/);
});

test("membership settings draft and discount changes are audit logged", () => {
  assert.match(routeSource, /bgm_audit_log/);
  assert.match(routeSource, /membership_settings\.price_draft\.saved/);
  assert.match(routeSource, /membership_settings\.declaration_draft\.saved/);
  assert.match(routeSource, /membership_settings\.discount\.saved/);
  assert.match(routeSource, /membership_settings\.discount\.active_changed/);
});

test("membership settings actor identity always comes from the authenticated system context", () => {
  assert.match(routeSource, /auth\.context\.systemUserId/);
  assert.doesNotMatch(routeSource, /body\.(?:systemUserId|system_user_id|createdBySystemUserId)/);
});
