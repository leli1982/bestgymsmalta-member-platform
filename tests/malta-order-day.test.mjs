import test from "node:test";
import assert from "node:assert/strict";
import { maltaDayUtcRange } from "../lib/maltaDate.ts";

test("Malta business day spans the correct ordinary local day in winter and summer", () => {
  assert.deepEqual(maltaDayUtcRange("2026-01-15"), {
    start: "2026-01-14T23:00:00.000Z",
    end: "2026-01-15T23:00:00.000Z",
  });
  assert.deepEqual(maltaDayUtcRange("2026-07-15"), {
    start: "2026-07-14T22:00:00.000Z",
    end: "2026-07-15T22:00:00.000Z",
  });
});

test("Malta Sundries date filters preserve the 23-hour spring and 25-hour autumn DST days", () => {
  assert.deepEqual(maltaDayUtcRange("2026-03-29"), {
    start: "2026-03-28T23:00:00.000Z",
    end: "2026-03-29T22:00:00.000Z",
  });
  assert.deepEqual(maltaDayUtcRange("2026-10-25"), {
    start: "2026-10-24T22:00:00.000Z",
    end: "2026-10-25T23:00:00.000Z",
  });
  assert.throws(() => maltaDayUtcRange("2026-02-30"));
});
