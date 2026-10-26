import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  constantTimeSecretHashEquals,
  hashTerminalSecret,
  terminalCookieName,
} from "@/lib/staffTerminalAuth";

export type StaffTerminalContext = {
  terminalId: string;
  gymId: string;
  name: string;
};

type StaffTerminalAuthResult =
  | { context: StaffTerminalContext; error: null }
  | { context: null; error: NextResponse };

export async function requireStaffTerminal(
  request: NextRequest
): Promise<StaffTerminalAuthResult> {
  const raw = request.cookies.get(terminalCookieName())?.value?.trim() || "";
  const separator = raw.indexOf(".");
  if (separator <= 0 || separator === raw.length - 1) {
    return {
      context: null,
      error: NextResponse.json({ error: "Punch Clock terminal is not provisioned." }, { status: 401 }),
    };
  }

  const terminalId = raw.slice(0, separator);
  const secret = raw.slice(separator + 1);
  const supabase = getSupabaseAdmin();
  const terminalResult = await supabase
    .from("bgm_staff_terminals")
    .select("id, gym_id, name, credential_hash, active")
    .eq("id", terminalId)
    .maybeSingle();

  if (terminalResult.error) throw terminalResult.error;
  const terminal = terminalResult.data;
  const presentedHash = hashTerminalSecret(secret);
  if (
    !terminal ||
    !terminal.active ||
    !constantTimeSecretHashEquals(terminal.credential_hash, presentedHash)
  ) {
    return {
      context: null,
      error: NextResponse.json({ error: "Punch Clock terminal authentication failed." }, { status: 401 }),
    };
  }

  await supabase
    .from("bgm_staff_terminals")
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", terminal.id);

  return {
    context: {
      terminalId: terminal.id,
      gymId: terminal.gym_id,
      name: terminal.name,
    },
    error: null,
  };
}
