import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/staff/membership-settings/page.tsx", "utf8");
const component = readFileSync("components/staff/MembershipSettingsAdmin.tsx", "utf8");
const dashboard = readFileSync("components/staff/StaffDashboard.tsx", "utf8");

test("membership settings page renders the dedicated Super Admin editor", () => {
  assert.match(page, /MembershipSettingsAdmin/);
  assert.match(component, /\/api\/system\/auth/);
  assert.match(component, /isSuperAdmin/);
  assert.match(component, /Super Admin access required/i);
});

test("membership settings UI exposes pricing, discount and declaration sections", () => {
  assert.match(component, /Pricing/);
  assert.match(component, /Discount Codes/);
  assert.match(component, /Rules & Declarations/);
});

test("pricing editor covers the approved 3 by 6 matrix and formats EUR for Malta", () => {
  for (const membershipType of ["single", "student", "couples"]) {
    assert.match(component, new RegExp(`\\b${membershipType}\\b`));
  }
  for (const duration of ["1_week", "2_weeks", "1_month", "3_months", "6_months", "1_year"]) {
    assert.match(component, new RegExp(`\\b${duration}\\b`));
  }
  assert.match(component, /data-price-cell/);
  assert.match(component, /Intl\.NumberFormat\("en-MT"/);
  assert.match(component, /currency:\s*"EUR"/);
  assert.match(component, /Publish Prices/);
  assert.match(component, /save_price_draft/);
  assert.match(component, /publish_price_catalog/);
});

test("discount editor exposes all centrally controlled fields", () => {
  assert.match(component, /Discount code/i);
  assert.match(component, /Percentage/i);
  assert.match(component, /Valid from/i);
  assert.match(component, /Valid until/i);
  assert.match(component, /Maximum successful uses/i);
  assert.match(component, /Active/i);
  assert.match(component, /save_discount_code/);
  assert.match(component, /set_discount_active/);
});

test("declaration editor supports every versioned declaration key without overwriting history", () => {
  for (const key of ["gym_rules", "legacy_declaration", "privacy", "health", "guardian"]) {
    assert.match(component, new RegExp(`\\b${key}\\b`));
  }
  assert.match(component, /Save Draft/);
  assert.match(component, /Publish Declaration/);
  assert.match(component, /contentSha256/);
  assert.match(component, /publishedAt/);
  assert.match(component, /save_declaration_draft/);
  assert.match(component, /publish_declaration/);
});

test("only Super Admin sees the dashboard entry point", () => {
  assert.match(dashboard, /user\.isSuperAdmin/);
  assert.match(dashboard, /\/staff\/membership-settings/);
  assert.match(dashboard, /Membership Settings/);
});
