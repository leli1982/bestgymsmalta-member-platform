import test from "node:test";
import assert from "node:assert/strict";
import { nfcReceptionPresentation } from "../lib/nfcReceptionCore.ts";

test("granted access uses green success presentation and auto reset", () => {
  assert.deepEqual(nfcReceptionPresentation("granted"), {
    title: "ACTIVE",
    tone: "success",
    severity: "success",
    autoResetMs: 4500,
  });
});

test("denied access uses persistent warning presentation", () => {
  for (const result of ["expired", "inactive", "unknown_card", "disabled_card"]) {
    const presentation = nfcReceptionPresentation(result);
    assert.equal(presentation.tone, "warning");
    assert.equal(presentation.severity, "danger");
    assert.equal(presentation.autoResetMs, null);
  }
  assert.equal(nfcReceptionPresentation("expired").title, "EXPIRED");
  assert.equal(nfcReceptionPresentation("unknown_card").title, "UNKNOWN CARD");
});
