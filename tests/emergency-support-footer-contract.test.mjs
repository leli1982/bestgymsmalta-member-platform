import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const footer = readFileSync(new URL("../components/system/EmergencySupportFooter.tsx", import.meta.url), "utf8");
const staffLayout = readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");
const managerLayout = readFileSync(new URL("../app/manager/layout.tsx", import.meta.url), "utf8");

test("emergency contact appears on Staff and Manager layouts with the approved wording", () => {
  assert.match(footer, /For Emergency issues contact Andre on 7909 0998/);
  assert.match(staffLayout, /EmergencySupportFooter/);
  assert.match(managerLayout, /EmergencySupportFooter/);
});

test("Super Admin staff/admin routes are explicitly excluded", () => {
  assert.match(footer, /pathname\.startsWith\("\/staff\/admin"\)/);
});

test("emergency contact is excluded from printed membership documents", () => {
  assert.match(footer, /print:hidden/);
});
