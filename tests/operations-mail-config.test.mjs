import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperationsMailConfig } from "../lib/operationsMailConfig.ts";

test("requires manager recipient and Gmail SMTP credentials", () => {
  assert.equal(resolveOperationsMailConfig({}), null);
  assert.equal(
    resolveOperationsMailConfig({
      BGM_ORDERS_MANAGER_EMAIL: "manager@example.com",
      GMAIL_USER: "sender@gmail.com",
    }),
    null
  );
});

test("resolves operational order mail configuration without hard-coded recipients", () => {
  assert.deepEqual(
    resolveOperationsMailConfig({
      BGM_ORDERS_MANAGER_EMAIL: " manager@example.com ",
      GMAIL_USER: "sender@gmail.com",
      GMAIL_APP_PASSWORD: "app-password",
      GMAIL_FROM: "BestGymsMalta <orders@example.com>",
    }),
    {
      recipient: "manager@example.com",
      user: "sender@gmail.com",
      pass: "app-password",
      from: "BestGymsMalta <orders@example.com>",
    }
  );
});
