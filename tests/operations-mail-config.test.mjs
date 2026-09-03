import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperationsMailConfig } from "../lib/operationsMailConfig.ts";

test("requires Gmail SMTP user and app password", () => {
  assert.equal(resolveOperationsMailConfig({}), null);

  assert.equal(
    resolveOperationsMailConfig({
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

  assert.equal(
    resolveOperationsMailConfig({
      GMAIL_API_CLIENT_ID: "client-id",
      GMAIL_API_CLIENT_SECRET: "client-secret",
      GMAIL_API_REFRESH_TOKEN: "refresh-token",
      GMAIL_USER: "bgm.members.app@gmail.com",
      GMAIL_FROM: "BestGymsMalta <bgm.members.app@gmail.com>",
    }),
    null
  );
});

test("normalizes the Gmail App Password and uses the BGM sender fallback", () => {
  assert.deepEqual(
    resolveOperationsMailConfig({
      GMAIL_USER: " bgm.members.app@gmail.com ",
      GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    }),
    {
      user: "bgm.members.app@gmail.com",
      appPassword: "abcdefghijklmnop",
      from: "BestGymsMalta <bgm.members.app@gmail.com>",
    }
  );
});

test("honors an explicit Gmail From value without a hard-coded recipient", () => {
  assert.deepEqual(
    resolveOperationsMailConfig({
      GMAIL_USER: "bgm.members.app@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
      GMAIL_FROM: " BGM Orders <bgm.members.app@gmail.com> ",
    }),
    {
      user: "bgm.members.app@gmail.com",
      appPassword: "abcdefghijklmnop",
      from: "BGM Orders <bgm.members.app@gmail.com>",
    }
  );
});
