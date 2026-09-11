import test from "node:test";
import assert from "node:assert/strict";

import { classifySystemLoginError } from "../lib/systemLoginError.ts";

test("classifies a missing system session secret without exposing secret values", () => {
  const result = classifySystemLoginError(
    new Error("Missing BGM system session secret.")
  );

  assert.deepEqual(result, {
    code: "SESSION_SECRET_MISSING",
    message: "System session secret is missing in this Preview deployment.",
  });
});

test("classifies missing Supabase server configuration", () => {
  const result = classifySystemLoginError(
    new Error("Missing Supabase server environment variables.")
  );

  assert.deepEqual(result, {
    code: "SUPABASE_CONFIG_MISSING",
    message: "Supabase server configuration is missing in this Preview deployment.",
  });
});

test("keeps unknown login failures generic", () => {
  const result = classifySystemLoginError(new Error("some internal detail"));

  assert.deepEqual(result, {
    code: "SYSTEM_LOGIN_FAILED",
    message: "System login failed.",
  });
});
