import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/membership/RegistrationForm.tsx", "utf8");

test("enrollment membership type buttons use the shared Regular, Student, and Couples themes", () => {
  assert.match(source, /membershipTheme/);
  assert.match(source, /resolveMembershipTheme\(option\.value\)/);
  assert.match(source, /theme\.background/);
  assert.match(source, /theme\.foreground/);
  assert.match(source, /aria-pressed=\{membershipType === option\.value\}/);
});
