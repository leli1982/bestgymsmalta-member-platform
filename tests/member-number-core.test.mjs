import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMembershipNumber,
  normalizeMembershipNumber,
  parseMembershipNumber,
} from "../lib/memberNumberCore.ts";

test("formats canonical variable-width BGM numbers without padding", () => {
  assert.equal(formatMembershipNumber(1000), "BGM1000");
  assert.equal(formatMembershipNumber(9999), "BGM9999");
  assert.equal(formatMembershipNumber(10000), "BGM10000");
  assert.equal(formatMembershipNumber(10_000_000n), "BGM10000000");
  assert.equal(
    formatMembershipNumber(BigInt(Number.MAX_SAFE_INTEGER) + 123n),
    `BGM${BigInt(Number.MAX_SAFE_INTEGER) + 123n}`
  );
});

test("parses only canonical BGM numbers starting at 1000", () => {
  assert.equal(parseMembershipNumber("BGM1000"), "1000");
  assert.equal(parseMembershipNumber("BGM10000"), "10000");
  assert.equal(parseMembershipNumber("BGM999"), null);
  assert.equal(parseMembershipNumber("BGM01000"), null);
  assert.equal(parseMembershipNumber("BGM0001000"), null);
  assert.equal(parseMembershipNumber("1000"), null);
  assert.equal(parseMembershipNumber("BGM1000.5"), null);
  assert.equal(parseMembershipNumber("BGM+1000"), null);
  assert.equal(parseMembershipNumber("BGM 1000"), null);
});

test("normalization uppercases and trims surrounding whitespace only", () => {
  assert.equal(normalizeMembershipNumber(" bgm1003 "), "BGM1003");
  assert.equal(normalizeMembershipNumber("1003"), "1003");
  assert.equal(normalizeMembershipNumber(null), "");
});

test("formatter rejects values below 1000, unsafe numbers and non-integers", () => {
  assert.throws(() => formatMembershipNumber(999));
  assert.throws(() => formatMembershipNumber(1000.5));
  assert.throws(() => formatMembershipNumber(Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => formatMembershipNumber(999n));
});
