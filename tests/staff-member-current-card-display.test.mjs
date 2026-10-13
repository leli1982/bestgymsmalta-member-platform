import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/system/members/search/route.ts", "utf8");
const browser = fs.readFileSync("components/staff/StaffMemberBrowser.tsx", "utf8");

test("staff member search returns the current active physical card separately from legacy pkCustomer", () => {
  assert.match(route, /currentPhysicalCard/);
  assert.match(route, /bgm_member_card_credentials/);
  assert.match(route, /status.*active/s);
});

test("staff member details label current physical card and legacy pkCustomer separately", () => {
  assert.match(browser, /currentPhysicalCard/);
  assert.match(browser, /Current physical card/);
  assert.match(browser, /Legacy pkCustomer/);
  assert.doesNotMatch(browser, /Physical card \/ pkCustomer/);
});
