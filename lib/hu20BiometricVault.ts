import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { hu20TestEnabled, validHu20TerminalId } from "./hu20TerminalSecurity.ts";

const PREFIX = "bgm-hu20-gcm-v1";
const HEX_KEY = /^[0-9a-f]{64}$/i;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MIN_TEMPLATE_BYTES = 64;
const MAX_TEMPLATE_BYTES = 65536;

export type Hu20BiometricContext = {
  employeeId: string;
  credentialId: string;
  templateFormat: "ANSI378";
};
type VaultEnv = Parameters<typeof hu20TestEnabled>[0] & {
  BGM_HU20_TEMPLATE_KEY?: string;
};

function getKey(env: VaultEnv): Buffer {
  if (!hu20TestEnabled(env)) throw new Error("HU20 biometric vault disabled outside TEST Preview.");
  if (!HEX_KEY.test(env.BGM_HU20_TEMPLATE_KEY || "")) {
    throw new Error("Missing or malformed HU20 biometric encryption key.");
  }
  return Buffer.from(env.BGM_HU20_TEMPLATE_KEY!, "hex");
}

function aad(ctx: Hu20BiometricContext): Buffer {
  if (!validHu20TerminalId(ctx.employeeId) || !validHu20TerminalId(ctx.credentialId) ||
      ctx.templateFormat !== "ANSI378") {
    throw new Error("Invalid HU20 biometric context.");
  }
  return Buffer.from([PREFIX, ctx.employeeId.toLowerCase(), ctx.credentialId.toLowerCase(), "ANSI378"].join("|"), "utf8");
}

/**
 * Server-only authenticated encryption for a future supervised enrollment
 * workflow. This module does not expose a biometric endpoint or enable punches.
 */
export function sealHu20Template(template: Uint8Array, ctx: Hu20BiometricContext, env: VaultEnv): string {
  const key = getKey(env);
  try {
    const associatedData = aad(ctx);
    if (!(template instanceof Uint8Array) ||
        template.byteLength < MIN_TEMPLATE_BYTES || template.byteLength > MAX_TEMPLATE_BYTES) {
      throw new Error("Invalid HU20 ANSI378 template length.");
    }
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    cipher.setAAD(associatedData);
    const ciphertext = Buffer.concat([cipher.update(template), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [PREFIX, nonce.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
  } finally {
    key.fill(0);
  }
}

export function openHu20Template(envelope: string, ctx: Hu20BiometricContext, env: VaultEnv): Buffer {
  const key = getKey(env);
  try {
    const associatedData = aad(ctx);
    const pieces = envelope.split(".");
    if (pieces.length !== 4 || pieces[0] !== PREFIX ||
        pieces.slice(1).some((value) => !BASE64URL.test(value))) {
      throw new Error("Unsupported HU20 biometric template envelope.");
    }
    const [nonce, tag, ciphertext] = pieces.slice(1).map((value) => Buffer.from(value, "base64url"));
    if (nonce.length !== 12 || tag.length !== 16 ||
        ciphertext.length < MIN_TEMPLATE_BYTES || ciphertext.length > MAX_TEMPLATE_BYTES) {
      throw new Error("Invalid HU20 biometric template envelope.");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    decipher.setAAD(associatedData);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } finally {
    key.fill(0);
  }
}
