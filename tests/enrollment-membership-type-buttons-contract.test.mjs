import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form = fs.readFileSync("components/membership/RegistrationForm.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("enrollment exposes Regular, Student and Couples as three buttons", () => {
  assert.match(form, /label: "Regular"/);
  assert.match(form, /label: "Student"/);
  assert.match(form, /label: "Couples"/);
  assert.match(form, /MEMBERSHIP_OPTIONS\.map/);
});

test("enrollment membership buttons use the approved card colours", () => {
  assert.match(css, /BGM enrollment membership theme/);
  assert.match(css, /#111111/);
  assert.match(css, /#166534/);
  assert.match(css, /#B91C1C/i);
  assert.match(css, /membership-type-selected/);
});
