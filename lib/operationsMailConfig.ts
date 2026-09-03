export type OperationsMailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  user: string;
  from: string;
};

export function resolveOperationsMailConfig(
  env: Record<string, string | undefined>
): OperationsMailConfig | null {
  const clientId = String(env.GMAIL_API_CLIENT_ID || "").trim();
  const clientSecret = String(env.GMAIL_API_CLIENT_SECRET || "").trim();
  const refreshToken = String(env.GMAIL_API_REFRESH_TOKEN || "").trim();
  const user = String(env.GMAIL_USER || "").trim();
  const from = String(env.GMAIL_FROM || "").trim();

  if (!clientId || !clientSecret || !refreshToken || !user || !from) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, user, from };
}
