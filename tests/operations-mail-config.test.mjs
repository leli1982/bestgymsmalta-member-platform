import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperationsMailConfig } from "../lib/operationsMailConfig.ts";

test("requires Gmail SMTP credentials but not an order recipient environment variable", () => {
  assert.equal(resolveOperationsMailConfig({}), null);
  assert.equal(
    resolveOperationsMailConfig({
      GMAIL_USER: "sender@gmail.com",
    }),
    null
  );
});

test("resolves operational order SMTP configuration without a hard-coded recipient", () => {
  assert.deepEqual(
    resolveOperationsMailConfig({
      GMAIL_USER: "sender@gmail.com",
      GMAIL_APP_PASSWORD: "app-password",
      GMAIL_FROM: "BestGymsMalta <orders@example.com>",
    }),
    {
      user: "sender@gmail.com",
      pass: "app-password",
      from: "BestGymsMalta <orders@example.com>",
    }
  );
});
