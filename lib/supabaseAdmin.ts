import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseAdminConfig } from "@/lib/supabaseAdminConfig";

export function getSupabaseAdmin() {
  const config = resolveSupabaseAdminConfig({
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!config) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
