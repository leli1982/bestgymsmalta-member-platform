export type OperationsMailConfig = {
  recipient: string;
  user: string;
  pass: string;
  from: string;
};

export function resolveOperationsMailConfig(
  env: Record<string, string | undefined>
): OperationsMailConfig | null {
  const recipient = String(env.BGM_ORDERS_MANAGER_EMAIL || "").trim();
  const user = String(env.GMAIL_USER || "").trim();
  const pass = String(env.GMAIL_APP_PASSWORD || "").trim();

  if (!recipient || !user || !pass) return null;

  const from =
    String(env.GMAIL_FROM || "").trim() || `BestGymsMalta <${user}>`;

  return { recipient, user, pass, from };
}
