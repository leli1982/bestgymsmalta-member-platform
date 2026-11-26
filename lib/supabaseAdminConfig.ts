type SupabaseAdminEnvironment = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const LIVE_SUPABASE_URL = "https://jsuolemirhivqhjbjetv.supabase.co";
const TEST_SUPABASE_URL = "https://vlvyqdjhzdcxatilbdiv.supabase.co";
const TEST_ONLY_PREVIEW_BRANCHES = new Set([
  "feature/tablet-enrollment-membership-settings",
  "feature/launch-member-reconciliation",
  "feature/protected-developer-account",
  "feature/reserved-member-number-on-first-print",
  "fix/scanner-case-safe-identifiers",
  "feature/current-member-csv-roundtrip",
  "test/production-baseline-20261126",
]);

export function resolveSupabaseAdminConfig(env: SupabaseAdminEnvironment) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    process.env.VERCEL_ENV === "preview" &&
    TEST_ONLY_PREVIEW_BRANCHES.has(process.env.VERCEL_GIT_COMMIT_REF || "") &&
    (
      supabaseUrl !== TEST_SUPABASE_URL ||
      (env.NEXT_PUBLIC_SUPABASE_URL &&
        env.NEXT_PUBLIC_SUPABASE_URL !== TEST_SUPABASE_URL)
    )
  ) {
    // Fail closed before creating any Supabase service-role client.
    throw new Error("BGM TEST-only Preview: Supabase configuration does not point exclusively to TEST.");
  }

  if (process.env.VERCEL_ENV === "production" &&
    (supabaseUrl !== LIVE_SUPABASE_URL ||
      (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL !== LIVE_SUPABASE_URL))) {
    throw new Error("BGM LIVE: Supabase configuration must point exclusively to production.");
  }

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}
