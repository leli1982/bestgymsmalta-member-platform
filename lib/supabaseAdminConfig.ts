type SupabaseAdminEnvironment = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function resolveSupabaseAdminConfig(env: SupabaseAdminEnvironment) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feature/tablet-enrollment-membership-settings" &&
    (
      supabaseUrl !== "https://vlvyqdjhzdcxatilbdiv.supabase.co" ||
      (env.NEXT_PUBLIC_SUPABASE_URL &&
        env.NEXT_PUBLIC_SUPABASE_URL !== "https://vlvyqdjhzdcxatilbdiv.supabase.co")
    )
  ) {
    // Fail closed before creating any Supabase service-role client.
    throw new Error("BGM TEST-only Preview: Supabase configuration does not point exclusively to TEST.");
  }

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}
