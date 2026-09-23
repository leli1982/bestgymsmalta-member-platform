import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupabaseAdminConfig } from "../lib/supabaseAdminConfig.ts";

const testUrl = "https://vlvyqdjhzdcxatilbdiv.supabase.co";
const liveUrl = "https://jsuolemirhivqhjbjetv.supabase.co";
const key = "fake-test-key-not-a-secret";
const saved = { VERCEL_ENV: process.env.VERCEL_ENV, VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF };
test("BGM branch Preview refuses any Supabase URL other than TEST before client is created", () => {
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "feature/tablet-enrollment-membership-settings";
    assert.equal(resolveSupabaseAdminConfig({ SUPABASE_URL: testUrl, NEXT_PUBLIC_SUPABASE_URL: testUrl, SUPABASE_SERVICE_ROLE_KEY: key })?.supabaseUrl, testUrl);
    assert.throws(() => resolveSupabaseAdminConfig({ SUPABASE_URL: liveUrl, NEXT_PUBLIC_SUPABASE_URL: testUrl, SUPABASE_SERVICE_ROLE_KEY: key }), /TEST-only Preview/);
    assert.throws(() => resolveSupabaseAdminConfig({ SUPABASE_URL: testUrl, NEXT_PUBLIC_SUPABASE_URL: liveUrl, SUPABASE_SERVICE_ROLE_KEY: key }), /TEST-only Preview/);
    assert.throws(() => resolveSupabaseAdminConfig({ NEXT_PUBLIC_SUPABASE_URL: liveUrl, SUPABASE_SERVICE_ROLE_KEY: key }), /TEST-only Preview/);
  } finally {
    if (saved.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved.VERCEL_ENV;
    if (saved.VERCEL_GIT_COMMIT_REF === undefined) delete process.env.VERCEL_GIT_COMMIT_REF;
    else process.env.VERCEL_GIT_COMMIT_REF = saved.VERCEL_GIT_COMMIT_REF;
  }
});
