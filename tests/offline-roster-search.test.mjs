import test from "node:test";
import assert from "node:assert/strict";
import {
  filterOfflineRoster,
  offlineRosterAgeState,
} from "../lib/offlineRosterSearch.ts";

const members = [
  { memberNumber: "BGM001", fullName: "Maria Borg", cardNumbers: ["M112232"] },
  { memberNumber: "BGM002", fullName: "John Vella", cardNumbers: ["K998877"] },
];

test("offline lookup searches by member number, physical card or name case-insensitively", () => {
  assert.deepEqual(filterOfflineRoster(members, "bgm001"), [members[0]]);
  assert.deepEqual(filterOfflineRoster(members, "m112232"), [members[0]]);
  assert.deepEqual(filterOfflineRoster(members, "K998"), [members[1]]);
  assert.deepEqual(filterOfflineRoster(members, "vella"), [members[1]]);
  assert.deepEqual(filterOfflineRoster(members, "MARIA"), [members[0]]);
});

test("old cached rosters without card numbers remain searchable", () => {
  const legacy = [{ memberNumber: "BGM003", fullName: "Old Cache" }];
  assert.deepEqual(filterOfflineRoster(legacy, "bgm003"), legacy);
});

test("offline roster age clearly distinguishes current, old and very old copies", () => {
  const now = Date.parse("2026-09-03T12:00:00Z");
  assert.equal(offlineRosterAgeState("2026-09-03T00:00:00Z", now), "current");
  assert.equal(offlineRosterAgeState("2026-09-02T00:00:00Z", now), "old");
  assert.equal(offlineRosterAgeState("2026-08-30T00:00:00Z", now), "very_old");
});
