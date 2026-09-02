import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const systemSecretConfigured = Boolean(
    process.env.BGM_SYSTEM_SESSION_SECRET ||
      process.env.BGM_ADMIN_SESSION_SECRET ||
      process.env.BGM_ADMIN_PIN
  );

  let dbReachable = false;
  let superAdminFound = false;
  let active = false;
  let isSuperAdmin = false;

  if (supabaseConfigured) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("bgm_system_users")
        .select("username, active, is_super_admin")
        .eq("username", "superadmin")
        .maybeSingle();

      dbReachable = !error;
      if (!error && data) {
        superAdminFound = true;
        active = Boolean(data.active);
        isSuperAdmin = Boolean(data.is_super_admin);
      }
    } catch {
      dbReachable = false;
    }
  }

  return NextResponse.json({
    supabaseConfigured,
    systemSecretConfigured,
    dbReachable,
    superAdminFound,
    active,
    isSuperAdmin,
  });
}
