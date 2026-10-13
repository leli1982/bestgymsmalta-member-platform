import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const memberUi = readFileSync(new URL("../components/member/MemberReminderNotifications.tsx", import.meta.url), "utf8");
const adminUi = readFileSync(new URL("../components/admin/MemberEngagementSettingsAdmin.tsx", import.meta.url), "utf8");

test("member notification settings describe recurring comeback reminders", () => {
  assert.match(memberUi, /Comeback reminders while you’re away, plus streak achievement pushes\./);
  assert.doesNotMatch(memberUi, /3-day inactivity and streak achievement pushes\./);
});

test("Super Admin engagement settings describe the approved recurring inactivity cadence", () => {
  assert.match(
    adminUi,
    /Send eligible members friendly comeback reminders at 3, 5, 7, 10, 14, 21 and 30 days away, then every 14 days until they return\./,
  );
  assert.doesNotMatch(adminUi, /Remind eligible members after exactly 3 complete Malta calendar days away\./);
});
