import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperationsMailConfig } from "../lib/operationsMailConfig.ts";

test("requires Resend API credentials but not an order recipient environment variable", () => {
  assert.equal(resolveOperationsMailConfig({}), null);
  assert.equal(
    resolveOperationsMailConfig({
      RESEND_API_KEY: "re_test_key",
    }),
    null
  );

  assert.equal(
    resolveOperationsMailConfig({
      GMAIL_USER: "sender@gmail.com",
      GMAIL_APP_PASSWORD: "app-password",
      GMAIL_FROM: "BestGymsMalta <sender@gmail.com>",
    }),
    null
  );
});

test("resolves operational order Resend configuration without a hard-coded recipient", () => {
  assert.deepEqual(
    resolveOperationsMailConfig({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM: "BestGymsMalta <orders@example.com>",
    }),
    {
      apiKey: "re_test_key",
      from: "BestGymsMalta <orders@example.com>",
    }
  );
});
