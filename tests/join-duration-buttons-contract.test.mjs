import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/membership/RegistrationForm.tsx", import.meta.url), "utf8");

test("join registration shows duration choices as buttons instead of a dropdown", () => {
  assert.doesNotMatch(source, /<select\s+value=\{durationKey\}/);
  assert.match(source, /DURATION_OPTIONS\.filter/);
  assert.match(source, /type="button"/);
  assert.match(source, /setDurationKey\(option\.value\)/);
  assert.match(source, /durationKey === option\.value/);
});

test("duration buttons still come only from active configured prices for the selected membership type", () => {
  assert.match(source, /entry\.membershipType === membershipType/);
  assert.match(source, /entry\.durationKey === option\.value/);
  assert.match(source, /entry\.isActive !== false/);
});
