import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const coreUrl = new URL("../lib/memberEngagementCore.ts", import.meta.url);
assert.ok(existsSync(fileURLToPath(coreUrl)), "memberEngagementCore.ts must exist before C3 behavior can pass");

const {
  ENGAGEMENT_INACTIVITY_MILESTONES,
  ENGAGEMENT_INACTIVITY_REPEAT_DAYS,
  ENGAGEMENT_STREAK_MILESTONES,
  attendanceDatesFromCheckins,
  buildInactivityEvent,
  buildStreakEvent,
  evaluateMotivationalEligibility,
} = await import(coreUrl.href);

test("canonical check-ins resolve to Malta calendar dates and same-day visits count once", () => {
  const dates = attendanceDatesFromCheckins([
    { checkin_at: "2026-10-24T22:30:00.000Z", source: "qr" },
    { checkin_at: "2026-10-25T07:00:00.000Z", source: "barcode" },
    { checkin_at: "2026-10-25T23:30:00.000Z", source: "nfc" },
    { checkin_at: "2026-10-26T08:00:00.000Z", source: "manual" },
  ]);
  assert.deepEqual(dates, ["2026-10-25", "2026-10-26"]);
});

test("inactivity nudges use the approved milestone cadence and repeat every 14 days after day 30", () => {
  assert.deepEqual(ENGAGEMENT_INACTIVITY_MILESTONES, [3, 5, 7, 10, 14, 21, 30]);
  assert.equal(ENGAGEMENT_INACTIVITY_REPEAT_DAYS, 14);

  const lastVisit = "2026-10-01";
  const expectedDays = [3, 5, 7, 10, 14, 21, 30, 44, 58, 72];
  for (const daysAway of expectedDays) {
    const date = new Date(Date.UTC(2026, 9, 1 + daysAway)).toISOString().slice(0, 10);
    const event = buildInactivityEvent([lastVisit], date);
    assert.ok(event, `expected inactivity event at ${daysAway} days away`);
    assert.equal(event.eventKey, `inactivity:${lastVisit}:${daysAway}`);
    assert.match(event.body, new RegExp(`\\b${daysAway}\\b`));
    assert.equal(event.href, "/gyms");
  }

  for (const daysAway of [1, 2, 4, 6, 8, 9, 11, 13, 15, 20, 22, 29, 31, 43, 45, 57, 59]) {
    const date = new Date(Date.UTC(2026, 9, 1 + daysAway)).toISOString().slice(0, 10);
    assert.equal(buildInactivityEvent([lastVisit], date), null, `did not expect event at ${daysAway} days away`);
  }
});

test("a new gym check-in resets the inactivity cadence from the latest attendance date", () => {
  const event = buildInactivityEvent(["2026-10-01", "2026-10-10"], "2026-10-13");
  assert.ok(event);
  assert.equal(event.eventKey, "inactivity:2026-10-10:3");
  assert.equal(buildInactivityEvent([], "2026-10-13"), null);
});

test("streak milestones are fixed and duplicate same-day visits cannot inflate them", () => {
  assert.deepEqual(ENGAGEMENT_STREAK_MILESTONES, [3, 5, 7, 14, 30]);
  const event = buildStreakEvent(
    ["2026-10-01", "2026-10-01", "2026-10-02", "2026-10-03"],
    "2026-10-03",
  );
  assert.deepEqual(event, {
    eventType: "streak",
    eventKey: "streak:2026-10-01:3",
    eventDate: "2026-10-03",
    title: "3-day streak 🔥",
    body: "Three days in a row. Keep that momentum going!",
    href: "/passport",
  });
});

test("a missed calendar day breaks the streak and a later streak can earn the same milestone", () => {
  assert.equal(buildStreakEvent(["2026-10-01", "2026-10-02", "2026-10-04"], "2026-10-04"), null);
  const event = buildStreakEvent(
    ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-06", "2026-10-07", "2026-10-08"],
    "2026-10-08",
  );
  assert.equal(event?.eventKey, "streak:2026-10-06:3");
});

test("streak delivery is fresh-only so rollout cannot backfill an old milestone", () => {
  const dates = ["2026-10-01", "2026-10-02", "2026-10-03"];
  assert.ok(buildStreakEvent(dates, "2026-10-03"));
  assert.ok(buildStreakEvent(dates, "2026-10-04"));
  assert.equal(buildStreakEvent(dates, "2026-10-05"), null);
});

test("motivational eligibility excludes expired grace locked cancelled archived and opted-out members", () => {
  const base = {
    appEnrolled: true,
    archivedAt: null,
    status: "active",
    membershipExpiry: "2026-10-08",
    cancellationEffectiveDate: null,
    today: "2026-10-08",
    motivationalEnabled: true,
    hasActiveSubscription: true,
  };
  assert.deepEqual(evaluateMotivationalEligibility(base), { eligible: true, reason: null });
  assert.equal(evaluateMotivationalEligibility({ ...base, membershipExpiry: "2026-10-07" }).eligible, false);
  assert.equal(evaluateMotivationalEligibility({ ...base, cancellationEffectiveDate: "2026-10-08" }).eligible, false);
  assert.equal(evaluateMotivationalEligibility({ ...base, archivedAt: "2026-10-01T00:00:00Z" }).eligible, false);
  assert.equal(evaluateMotivationalEligibility({ ...base, status: "inactive" }).eligible, false);
  assert.equal(evaluateMotivationalEligibility({ ...base, motivationalEnabled: false }).eligible, false);
  assert.equal(evaluateMotivationalEligibility({ ...base, hasActiveSubscription: false }).eligible, false);
});
