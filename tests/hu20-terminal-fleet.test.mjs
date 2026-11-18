import assert from "node:assert/strict";
import test from "node:test";
import { hu20TerminalContactStatus, HU20_RECENT_CONTACT_MS } from "../lib/hu20TerminalFleet.ts";

test("TEST fleet contact is observation, not kiosk online state", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  assert.equal(hu20TerminalContactStatus(null, now), "never");
  assert.equal(hu20TerminalContactStatus(undefined, now), "never");
  assert.equal(hu20TerminalContactStatus("not-a-date", now), "invalid");
  assert.equal(hu20TerminalContactStatus("2026-11-16T12:02:00Z", now), "invalid");
  assert.equal(hu20TerminalContactStatus("2026-11-16T11:59:30Z", now), "recent");
  assert.equal(hu20TerminalContactStatus(new Date(now-HU20_RECENT_CONTACT_MS).toISOString(), now), "recent");
  assert.equal(hu20TerminalContactStatus(new Date(now-HU20_RECENT_CONTACT_MS-1).toISOString(), now), "stale");
});
