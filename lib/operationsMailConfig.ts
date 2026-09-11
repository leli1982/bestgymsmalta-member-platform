export type OperationsMailConfig = {
  user: string;
  appPassword: string;
  from: string;
};

export function resolveOperationsMailConfig(
  env: Record<string, string | undefined>
): OperationsMailConfig | null {
  const user = String(env.GMAIL_USER || "").trim();
  const appPassword = String(env.GMAIL_APP_PASSWORD || "")
    .replace(/\s+/g, "")
    .trim();
  const from =
    String(env.GMAIL_FROM || "").trim() ||
    (user ? `BestGymsMalta <${user}>` : "");

  if (!user || !appPassword || !from) {
    return null;
  }

  return { user, appPassword, from };
}
