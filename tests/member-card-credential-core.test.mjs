import assert from "node:assert/strict";
import test from "node:test";
import {
  decideRenewalCardAction,
  isConcatenatedPhysicalBarcode,
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

test("case-only variation keeps the current card and preserves leading zeroes", () => {
  assert.equal(decideRenewalCardAction("X06469", "x06469"), "keep");
  assert.equal(decideRenewalCardAction("x06469", "X06469"), "keep");
  assert.equal(decideRenewalCardAction("X06469", "X6469"), "replace");
});

test("obvious concatenated X-series card scans are rejected without changing valid opaque credentials", () => {
  for (const value of ["X03872X03846X03872", "x11253X11252", "X06956X06956"]) assert.equal(isConcatenatedPhysicalBarcode(value), true);
  for (const value of ["X06469", "x0000", "0012345", "P436", "AbC-007", "X123Y456"]) assert.equal(isConcatenatedPhysicalBarcode(value), false);
});
