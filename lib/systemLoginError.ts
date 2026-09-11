export type SystemLoginErrorInfo = {
  code: "SESSION_SECRET_MISSING" | "SUPABASE_CONFIG_MISSING" | "SYSTEM_LOGIN_FAILED";
  message: string;
};

export function classifySystemLoginError(error: unknown): SystemLoginErrorInfo {
  const message = error instanceof Error ? error.message : "";

  if (message === "Missing BGM system session secret.") {
    return {
      code: "SESSION_SECRET_MISSING",
      message: "System session secret is missing in this Preview deployment.",
    };
  }

  if (message === "Missing Supabase server environment variables.") {
    return {
      code: "SUPABASE_CONFIG_MISSING",
      message: "Supabase server configuration is missing in this Preview deployment.",
    };
  }

  return {
    code: "SYSTEM_LOGIN_FAILED",
    message: "System login failed.",
  };
}
