import assert from "node:assert/strict";
import test from "node:test";

import {
  isMidnightAutoClockOutDue,
  midnightAutoClockOutCutoff,
  midnightAutoClockOutEventKey,
} from "../lib/staffMidnightAutoClockOut.ts";

test("midnight auto clock-out uses the next Malta midnight in winter", () => {
  assert.equal(
    midnightAutoClockOutCutoff("2026-01-15T20:00:00.000Z"),
    "2026-01-15T23:00:00.000Z",
  );
});

test("midnight auto clock-out uses the next Malta midnight in summer", () => {
  assert.equal(
    midnightAutoClockOutCutoff("2026-07-15T20:00:00.000Z"),
    "2026-07-15T22:00:00.000Z",
  );
});

test("midnight auto clock-out becomes due only at or after the exact Malta cutoff", () => {
  const clockIn = "2026-07-15T20:00:00.000Z";
  assert.equal(isMidnightAutoClockOutDue(clockIn, new Date("2026-07-15T21:59:59.999Z")), false);
  assert.equal(isMidnightAutoClockOutDue(clockIn, new Date("2026-07-15T22:00:00.000Z")), true);
  assert.equal(isMidnightAutoClockOutDue(clockIn, new Date("2026-07-15T23:00:00.000Z")), true);
});

test("midnight auto clock-out event keys are deterministic for retry idempotency", () => {
  const cutoff = "2026-07-15T22:00:00.000Z";
  assert.equal(
    midnightAutoClockOutEventKey("session-123", cutoff),
    "staff-midnight-auto-clock-out:session-123:2026-07-15T22:00:00.000Z",
  );
  assert.equal(
    midnightAutoClockOutEventKey("session-123", cutoff),
    midnightAutoClockOutEventKey("session-123", cutoff),
  );
});
