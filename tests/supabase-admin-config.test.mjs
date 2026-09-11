import assert from "node:assert/strict";
import test from "node:test";

import { resolveSupabaseAdminConfig } from "../lib/supabaseAdminConfig.ts";

test("uses SUPABASE_URL when present", () => {
  assert.deepEqual(
    resolveSupabaseAdminConfig({
      SUPABASE_URL: "https://server-url.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://public-url.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
    {
      supabaseUrl: "https://server-url.supabase.co",
      serviceRoleKey: "service-role-key",
    }
  );
});

test("falls back to NEXT_PUBLIC_SUPABASE_URL for the project URL", () => {
  assert.deepEqual(
    resolveSupabaseAdminConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://public-url.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
    {
      supabaseUrl: "https://public-url.supabase.co",
      serviceRoleKey: "service-role-key",
    }
  );
});

test("returns null when the service-role key is missing", () => {
  assert.equal(
    resolveSupabaseAdminConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://public-url.supabase.co",
    }),
    null
  );
});
