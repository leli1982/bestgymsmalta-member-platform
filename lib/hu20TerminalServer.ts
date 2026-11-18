import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hu20TestEnabled,
  validHu20TerminalId,
  verifyHu20TerminalSecret,
} from "@/lib/hu20TerminalSecurity";

export type Hu20TerminalIdentity = {
  id: string;
  gymId: string;
  name: string;
  model: string | null;
};

export function isHu20TestRequestEnabled() {
  return hu20TestEnabled(process.env);
}

/** Authenticate the kiosk itself, not the person currently scanning. */
export async function authenticateHu20Terminal(
  request: NextRequest,
): Promise<Hu20TerminalIdentity | null> {
  if (!isHu20TestRequestEnabled()) return null;
  const id = (request.headers.get("x-bgm-hu20-terminal-id") || "").trim();
  const bearer = request.headers.get("authorization") || "";
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(bearer);
  if (!validHu20TerminalId(id) || !match) return null;

  const db = getSupabaseAdmin();
  const result = await db
    .from("bgm_staff_terminals")
    .select("id, gym_id, name, credential_hash, active, model")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  const terminal = result.data;
  if (!terminal?.active || !verifyHu20TerminalSecret(match[1], terminal.credential_hash)) {
    return null;
  }
  const gym = await db.from("bgm_gyms").select("id, status").eq("id", terminal.gym_id).maybeSingle();
  if (gym.error) throw gym.error;
  if (!gym.data || gym.data.status !== "active") return null;
  return { id: terminal.id, gymId: terminal.gym_id, name: terminal.name, model: terminal.model };
}
