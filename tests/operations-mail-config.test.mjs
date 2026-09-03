import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperationsMailConfig } from "../lib/operationsMailConfig.ts";

test("requires complete Gmail API OAuth credentials", () => {
  assert.equal(resolveOperationsMailConfig({}), null);
  assert.equal(
    resolveOperationsMailConfig({
      GMAIL_API_CLIENT_ID: "client-id",
      GMAIL_API_CLIENT_SECRET: "client-secret",
      GMAIL_API_REFRESH_TOKEN: "refresh-token",
      GMAIL_USER: "bgm.members.app@gmail.com",
    }),
    null
  );

  assert.equal(
    resolveOperationsMailConfig({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM: "BestGymsMalta <orders@example.com>",
    }),
    null
  );
});

test("resolves Gmail API configuration without a hard-coded recipient", () => {
  assert.deepEqual(
    resolveOperationsMailConfig({
      GMAIL_API_CLIENT_ID: "client-id",
      GMAIL_API_CLIENT_SECRET: "client-secret",
      GMAIL_API_REFRESH_TOKEN: "refresh-token",
      GMAIL_USER: "bgm.members.app@gmail.com",
      GMAIL_FROM: "BestGymsMalta <bgm.members.app@gmail.com>",
    }),
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      user: "bgm.members.app@gmail.com",
      from: "BestGymsMalta <bgm.members.app@gmail.com>",
    }
  );
});
