import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SystemContext } from "@/lib/systemAuth";

export const STAFF_EMPLOYEE_SELECT =
  "id, first_name, surname, id_number, address, mobile, email, home_gym_id, photo_path, linked_system_user_id, active, created_at, updated_at";

export function cleanStaffText(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function optionalStaffText(value: unknown): string | null {
  const cleaned = cleanStaffText(value);
  return cleaned || null;
}

export function normalizeStaffEmail(value: unknown): string | null {
  const cleaned = cleanStaffText(value).toLowerCase();
  return cleaned || null;
}

export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isUniqueViolation(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "23505";
}

export async function writeStaffAudit(
  context: SystemContext,
  input: {
    actionKey: string;
    entityType: string;
    entityId: string | null;
    beforeData?: unknown;
    afterData?: unknown;
    contextGymId?: string | null;
  }
) {
  const db = getSupabaseAdmin();
  const result = await db.from("bgm_audit_log").insert({
    system_user_id: context.systemUserId,
    context_gym_id: input.contextGymId ?? context.gymId,
    staff_name: context.displayName || null,
    action_key: input.actionKey,
    entity_type: input.entityType,
    entity_id: input.entityId,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
  });
  if (result.error) throw result.error;
}

export async function loadStaffEmployee(
  db: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string
) {
  const result = await db
    .from("bgm_staff_employees")
    .select(STAFF_EMPLOYEE_SELECT)
    .eq("id", employeeId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
