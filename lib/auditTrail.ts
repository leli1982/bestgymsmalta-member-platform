import { maltaDayUtcRange } from "@/lib/maltaDate";

export type AuditFilters = {
  from: string;
  to: string;
  userId: string;
  gymId: string;
  action: string;
  entity: string;
  query: string;
};

export const AUDIT_SELECT = [
  "id","created_at","system_user_id","system_username","system_display_name",
  "system_is_super_admin","staff_name","context_gym_id","context_gym_name",
  "action_key","entity_type","entity_id","member_id","member_number","member_name",
  "before_data","after_data","category",
].join(",");

export function readAuditFilters(searchParams: URLSearchParams): AuditFilters {
  return {
    from: (searchParams.get("from") || "").trim(),
    to: (searchParams.get("to") || "").trim(),
    userId: (searchParams.get("user") || "").trim(),
    gymId: (searchParams.get("gym") || "").trim(),
    action: (searchParams.get("action") || "").trim(),
    entity: (searchParams.get("entity") || "").trim(),
    query: (searchParams.get("q") || "").trim(),
  };
}

export function applyAuditFilters(query: any, filters: AuditFilters) {
  let next = query;
  if (filters.from) next = next.gte("created_at", maltaDayUtcRange(filters.from).start);
  if (filters.to) next = next.lt("created_at", maltaDayUtcRange(filters.to).end);
  if (filters.userId) next = next.eq("system_user_id", filters.userId);
  if (filters.gymId) next = next.eq("context_gym_id", filters.gymId);
  if (filters.action) next = next.ilike("action_key", `%${filters.action}%`);
  if (filters.entity) next = next.ilike("entity_type", `%${filters.entity}%`);
  if (filters.query) next = next.ilike("search_text", `%${filters.query}%`);
  return next;
}

export function actionLabel(value: string) {
  return value
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function jsonText(value: unknown) {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
