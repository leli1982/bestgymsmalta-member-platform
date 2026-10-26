import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const STAFF_TERMINAL_COOKIE = "bgm_staff_terminal";
export const TERMINAL_SECRET_BYTES = 32;

export function createTerminalSecret(): string {
  return randomBytes(TERMINAL_SECRET_BYTES).toString("base64url");
}

export function hashTerminalSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function terminalCookieName(): string {
  return STAFF_TERMINAL_COOKIE;
}

export function constantTimeSecretHashEquals(
  expectedHash: string,
  actualHash: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/.test(expectedHash) ||
    !/^[a-f0-9]{64}$/.test(actualHash)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(actualHash, "hex")
  );
}
