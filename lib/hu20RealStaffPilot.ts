import { hu20TestEnabled } from "@/lib/hu20TerminalSecurity";

/** Strictly isolated TEST pilot, independent of fictional TEST or production. */
export function hu20RealStaffPilotEnabled(): boolean {
  return hu20TestEnabled(process.env) && process.env.BGM_HU20_REAL_STAFF_PILOT_ENABLED === "true";
}
