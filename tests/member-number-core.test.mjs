import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMembershipNumber,
  normalizeMembershipNumber,
  parseMembershipNumber,
} from "../lib/memberNumberCore.ts";

test("formats BGM plus exactly seven digits", () => {
  assert.equal(formatMembershipNumber(1), "BGM0000001");
  assert.equal(formatMembershipNumber(25418), "BGM0025418");
  assert.equal(formatMembershipNumber(9_999_999), "BGM9999999");
});

test("rejects malformed or out-of-range permanent numbers", () => {
  assert.equal(parseMembershipNumber("BGM0000001"), 1);
  assert.equal(parseMembershipNumber("BGM001"), null);
  assert.equal(parseMembershipNumber("0000001"), null);
  assert.equal(parseMembershipNumber("BGM10000000"), null);
  assert.equal(parseMembershipNumber("BGM0000000"), null);
});

test("normalization uppercases but never invents missing digits", () => {
  assert.equal(normalizeMembershipNumber(" bgm0000042 "), "BGM0000042");
  assert.equal(normalizeMembershipNumber("42"), "42");
  assert.equal(normalizeMembershipNumber(null), "");
});

test("formatter rejects zero, overflow and non-integers", () => {
  assert.throws(() => formatMembershipNumber(0));
  assert.throws(() => formatMembershipNumber(10_000_000));
  assert.throws(() => formatMembershipNumber(1.5));
});
