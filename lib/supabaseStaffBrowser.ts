import { createClient } from "@supabase/supabase-js";

export function createStaffRealtimeClient(
  supabaseUrl: string,
  publishableKey: string
) {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
