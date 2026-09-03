export type OperationsMailConfig = {
  apiKey: string;
  from: string;
};

export function resolveOperationsMailConfig(
  env: Record<string, string | undefined>
): OperationsMailConfig | null {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.RESEND_FROM || "").trim();

  if (!apiKey || !from) return null;

  return { apiKey, from };
}
