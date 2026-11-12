import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TEST_SUPABASE_URL = "https://vlvyqdjhzdcxatilbdiv.supabase.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/i;
const HASH = /^sha256:v1:[a-f0-9]{64}$/;

type Hu20Environment = {
  BGM_HU20_TEST_ENABLED?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

// Never trust a feature flag alone: Production must not be able to run HU20
// experimental endpoints, even if that flag is accidentally enabled.
export function hu20TestEnabled(env: Hu20Environment): boolean {
  if (env.BGM_HU20_TEST_ENABLED !== "true") return false;
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV !== "preview" &&
      !(env.VERCEL_ENV === undefined && env.NODE_ENV === "development")) return false;
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  return url === TEST_SUPABASE_URL &&
    (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL === TEST_SUPABASE_URL);
}

export function validHu20TerminalId(value: string): boolean {
  return UUID.test(value);
}

export function issueHu20TerminalSecret(): { secret: string; credentialHash: string } {
  const secret = randomBytes(32).toString("hex");
  return { secret, credentialHash: hu20CredentialHash(secret) };
}

export function hu20CredentialHash(secret: string): string {
  return "sha256:v1:" + createHash("sha256").update(secret, "utf8").digest("hex");
}

export function verifyHu20TerminalSecret(secret: string, credentialHash: string): boolean {
  if (!TOKEN.test(secret) || !HASH.test(credentialHash)) return false;
  const supplied = Buffer.from(hu20CredentialHash(secret), "utf8");
  const expected = Buffer.from(credentialHash, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
