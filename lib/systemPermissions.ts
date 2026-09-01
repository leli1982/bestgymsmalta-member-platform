export const SYSTEM_PERMISSION_KEYS = [
  "members.view",
  "members.create",
  "members.edit",
  "members.renew",
  "members.photos.view",
  "membership.activate",
  "nfc.scan",
  "nfc.assign",
  "nfc.replace",
  "checkins.view",
  "orders.sundries.submit",
  "orders.sundries.history",
  "orders.bar.submit",
  "orders.bar.history",
  "orders.manage",
  "announcements.manage",
  "analytics.view",
  "members.export",
  "members.archive",
  "gyms.manage",
  "system_users.manage",
  "offline_roster.view",
] as const;

export type SystemPermissionKey = (typeof SYSTEM_PERMISSION_KEYS)[number];

export function isSystemPermissionKey(value: string): value is SystemPermissionKey {
  return (SYSTEM_PERMISSION_KEYS as readonly string[]).includes(value);
}

export function normalizeSystemUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
