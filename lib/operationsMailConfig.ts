export type OperationsMailConfig = {
  user: string;
  pass: string;
  from: string;
};

export function resolveOperationsMailConfig(
  env: Record<string, string | undefined>
): OperationsMailConfig | null {
  const user = String(env.GMAIL_USER || "").trim();
  const pass = String(env.GMAIL_APP_PASSWORD || "").trim();

  if (!user || !pass) return null;

  const from =
    String(env.GMAIL_FROM || "").trim() || `BestGymsMalta <${user}>`;

  return { user, pass, from };
}
