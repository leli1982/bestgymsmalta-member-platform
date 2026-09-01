import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type SystemSessionIdentity = {
  systemUserId: string;
  gymId: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

export type SystemSession = SystemSessionIdentity & {
  issuedAt: number;
  expiresAt: number;
};

type CreateOptions = {
  now?: number;
  ttlMs?: number;
  nonce?: string;
};

type VerifyOptions = {
  now?: number;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSystemSessionToken(
  identity: SystemSessionIdentity,
  secret: string,
  options: CreateOptions = {}
) {
  if (!identity.systemUserId || !identity.username || !secret) {
    throw new Error("System user identity and session secret are required.");
  }

  const issuedAt = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 8 * 60 * 60 * 1000;
  const expiresAt = issuedAt + ttlMs;
  const nonce = options.nonce ?? randomBytes(16).toString("hex");

  const payload = Buffer.from(
    JSON.stringify({ ...identity, issuedAt, expiresAt, nonce })
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifySystemSessionToken(
  token: string | undefined,
  secret: string,
  options: VerifyOptions = {}
): SystemSession | null {
  if (!token || !secret || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<SystemSession>;
    const now = options.now ?? Date.now();

    if (
      typeof parsed.systemUserId !== "string" ||
      !parsed.systemUserId ||
      typeof parsed.username !== "string" ||
      !parsed.username ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.isSuperAdmin !== "boolean" ||
      !Array.isArray(parsed.permissions) ||
      !parsed.permissions.every((item) => typeof item === "string") ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      return null;
    }

    return {
      systemUserId: parsed.systemUserId,
      gymId:
        typeof parsed.gymId === "string" || parsed.gymId === null
          ? parsed.gymId
          : null,
      username: parsed.username,
      displayName: parsed.displayName,
      isSuperAdmin: parsed.isSuperAdmin,
      permissions: parsed.permissions,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function hasSystemPermission(
  identity: Pick<SystemSessionIdentity, "isSuperAdmin" | "permissions">,
  permissionKey: string
) {
  if (identity.isSuperAdmin) return true;
  return identity.permissions.includes(permissionKey);
}
