import { createHash, randomBytes } from "node:crypto";

export function createDeveloperRecoveryToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashDeveloperRecoveryToken(token) };
}

export function hashDeveloperRecoveryToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function validDeveloperRecoveryToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function validDeveloperPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 14 && password.length <= 128;
}

export function developerRecoveryBaseUrl(env: NodeJS.ProcessEnv) {
  // Never trust an arbitrary request Host header when emailing recovery links.
  if (env.VERCEL_ENV === "production") return "https://bestgymsmalta-member-platform.vercel.app";
  if (env.VERCEL_URL && /^[a-z0-9.-]+$/i.test(env.VERCEL_URL)) return "https://" + env.VERCEL_URL;
  return env.NODE_ENV === "development" ? "http://localhost:3000" : null;
}
