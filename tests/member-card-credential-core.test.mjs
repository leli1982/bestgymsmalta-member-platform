import assert from "node:assert/strict";
import test from "node:test";
import {
  decideRenewalCardAction,
  normalizeBarcodePayload,
} from "../lib/memberCardCredentialCore.ts";

test("barcode normalization removes scanner terminators without changing credential characters", () => {
  assert.equal(normalizeBarcodePayload("0012345\n"), "0012345");
  assert.equal(normalizeBarcodePayload("AbC-007\r\n"), "AbC-007");
  assert.equal(normalizeBarcodePayload("  00042  "), "00042");
});

test("renewal keeps the exact active card when the same barcode is scanned", () => {
  assert.equal(decideRenewalCardAction("0012345", "0012345\n"), "keep");
});

test("renewal marks a different scanned card as replacement", () => {
  assert.equal(decideRenewalCardAction("0012345", "0099999"), "replace");
  assert.equal(decideRenewalCardAction(null, "0099999"), "replace");
});

test("blank scans are rejected", () => {
  assert.throws(() => decideRenewalCardAction("0012345", " \r\n"), /required/i);
});
