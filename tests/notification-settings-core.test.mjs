import test from "node:test";
import assert from "node:assert/strict";
import { validateOrderNotificationSettings } from "../lib/notificationSettingsCore.ts";

test("normalizes configurable order notification settings", () => {
  assert.deepEqual(
    validateOrderNotificationSettings({
      ordersEmail: "  INFO@BestGymsMalta.com ",
      emailEnabled: true,
      pushEnabled: false,
    }),
    {
      ordersEmail: "info@bestgymsmalta.com",
      emailEnabled: true,
      pushEnabled: false,
    }
  );
});

test("rejects invalid order notification email addresses", () => {
  assert.throws(
    () =>
      validateOrderNotificationSettings({
        ordersEmail: "not-an-email",
        emailEnabled: true,
        pushEnabled: true,
      }),
    /valid email/i
  );
});

test("rejects missing boolean notification toggles", () => {
  assert.throws(
    () =>
      validateOrderNotificationSettings({
        ordersEmail: "info@bestgymsmalta.com",
        emailEnabled: "yes",
        pushEnabled: true,
      }),
    /boolean/i
  );
});
