import "server-only";

import { JWT } from "google-auth-library";
import {
  googleWalletClassId,
  googleWalletObjectId,
  projectGoogleWalletMember,
  type GoogleWalletMemberSnapshot,
  type GoogleWalletProjection,
} from "./googleWalletCore.ts";
import { buildGoogleWalletSaveUrl as buildSaveUrl } from "./googleWalletSaveLink.ts";
import { todayMaltaDate } from "./maltaDate.ts";

const WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";

export type GoogleWalletConfig = {
  issuerId: string;
  serviceAccountEmail: string;
  privateKey: string;
  classSuffix: string;
  objectPrefix: string;
  origin: string;
  logoUrl: string;
  appUrl: string;
  classId: string;
};

type WalletResponse = {
  status: number;
  ok: boolean;
  data: unknown;
};

class GoogleWalletProviderError extends Error {
  status: number | null;

  constructor(status: number | null) {
    super("Google Wallet provider request failed.");
    this.name = "GoogleWalletProviderError";
    this.status = status;
  }
}

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

function httpsUrl(name: string, value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") throw new Error("not https");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Google Wallet ${name} is invalid.`);
  }
}

function localized(value: string) {
  return {
    defaultValue: {
      language: "en-US",
      value,
    },
  };
}

function googleObjectBody(
  snapshot: GoogleWalletMemberSnapshot,
  config: GoogleWalletConfig,
  clearStaleBarcodeAlternateText = false,
): Record<string, unknown> {
  const projection = projectGoogleWalletMember(snapshot, todayMaltaDate());
  const objectId = googleWalletObjectId(
    config.issuerId,
    snapshot.memberId,
    config.objectPrefix,
  );
  const barcode =
    clearStaleBarcodeAlternateText && projection.barcode.type === "TEXT_ONLY"
      ? { ...projection.barcode, alternateText: null }
      : projection.barcode;

  const body: Record<string, unknown> = {
    id: objectId,
    classId: config.classId,
    genericType: projection.genericType,
    state: projection.state,
    cardTitle: localized("BestGymsMalta"),
    subheader: localized("Gym membership"),
    header: localized(snapshot.fullName || "BGM Member"),
    hexBackgroundColor: "#ff5a0a",
    logo: {
      sourceUri: { uri: config.logoUrl },
      contentDescription: localized("BestGymsMalta logo"),
    },
    barcode,
    textModulesData: [
      {
        id: "member_number",
        header: "Member number",
        body: snapshot.memberNumber,
      },
      {
        id: "membership_status",
        header: "Status",
        body: projection.state === "ACTIVE"
          ? "Active"
          : projection.state === "EXPIRED"
            ? "Expired"
            : "Inactive",
      },
      {
        id: "membership_expiry",
        header: "Expiry",
        body: projection.expiryDisplay || "Not recorded",
      },
    ],
    linksModuleData: {
      uris: [
        {
          uri: config.appUrl,
          description: "Open BestGymsMalta",
          id: "bgm_member_app",
        },
      ],
    },
  };

  if (projection.validTimeIntervalEnd) {
    body.validTimeInterval = {
      end: { date: projection.validTimeIntervalEnd },
    };
  }

  // Deliberately omit `notifications`: C3 owns expiry/member notifications.
  return body;
}

export function getGoogleWalletConfig(): GoogleWalletConfig | null {
  if (env("GOOGLE_WALLET_ENABLED") !== "true") return null;

  const issuerId = env("GOOGLE_WALLET_ISSUER_ID");
  const serviceAccountEmail = env("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  const privateKey = env("GOOGLE_WALLET_PRIVATE_KEY").replace(/\\n/g, "\n");
  const classSuffix = env("GOOGLE_WALLET_CLASS_SUFFIX");
  const objectPrefix = env("GOOGLE_WALLET_OBJECT_PREFIX");
  const origin = env("GOOGLE_WALLET_ORIGIN");
  const logoUrl = env("GOOGLE_WALLET_LOGO_URL");
  const appUrl = env("GOOGLE_WALLET_APP_URL");

  if (
    !issuerId ||
    !serviceAccountEmail ||
    !privateKey ||
    !classSuffix ||
    !objectPrefix ||
    !origin ||
    !logoUrl ||
    !appUrl
  ) {
    throw new Error("Google Wallet is not fully configured.");
  }
  if (!/^\d+$/.test(issuerId)) throw new Error("Google Wallet issuer ID is invalid.");
  if (!/^[A-Za-z0-9._-]+$/.test(classSuffix)) throw new Error("Google Wallet class suffix is invalid.");
  if (!/^[A-Za-z0-9._-]+$/.test(objectPrefix)) throw new Error("Google Wallet object prefix is invalid.");
  if (!privateKey.includes("BEGIN PRIVATE KEY")) throw new Error("Google Wallet private key is invalid.");

  const trustedOrigin = httpsUrl("origin", origin);
  const trustedLogoUrl = httpsUrl("logo URL", logoUrl);
  const trustedAppUrl = httpsUrl("app URL", appUrl);

  return {
    issuerId,
    serviceAccountEmail,
    privateKey,
    classSuffix,
    objectPrefix,
    origin: trustedOrigin,
    logoUrl: trustedLogoUrl,
    appUrl: trustedAppUrl,
    classId: googleWalletClassId(issuerId, classSuffix),
  };
}

async function accessToken(config: GoogleWalletConfig): Promise<string> {
  const auth = new JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: [WALLET_SCOPE],
  });
  const response = await auth.getAccessToken();
  const token = response?.token;
  if (!token) throw new GoogleWalletProviderError(401);
  return token;
}

async function walletRequest(
  resource: string,
  init: RequestInit,
  config: GoogleWalletConfig,
): Promise<WalletResponse> {
  try {
    const token = await accessToken(config);
    const response = await fetch(`${WALLET_API}/${resource}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    const responseText = await response.text();
    let data: unknown = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }
    }
    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    if (error instanceof GoogleWalletProviderError) throw error;
    throw new GoogleWalletProviderError(null);
  }
}

export async function ensureGoogleWalletClass(
  config: GoogleWalletConfig,
): Promise<string> {
  const resource = `genericClass/${encodeURIComponent(config.classId)}`;
  const existing = await walletRequest(resource, { method: "GET" }, config);
  if (existing.ok) return config.classId;
  if (existing.status === 404) {
    const created = await walletRequest(
      "genericClass",
      {
        method: "POST",
        body: JSON.stringify({ id: config.classId }),
      },
      config,
    );
    if (created.ok) return config.classId;
    throw new GoogleWalletProviderError(created.status);
  }
  throw new GoogleWalletProviderError(existing.status);
}

export async function upsertGoogleWalletObject(
  snapshot: GoogleWalletMemberSnapshot,
  config: GoogleWalletConfig,
): Promise<{ objectId: string; classId: string }> {
  await ensureGoogleWalletClass(config);
  const objectId = googleWalletObjectId(
    config.issuerId,
    snapshot.memberId,
    config.objectPrefix,
  );
  const body = googleObjectBody(snapshot, config);
  const resource = `genericObject/${encodeURIComponent(objectId)}`;
  const existing = await walletRequest(resource, { method: "GET" }, config);

  if (existing.status === 404) {
    const created = await walletRequest(
      "genericObject",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      config,
    );
    if (!created.ok) throw new GoogleWalletProviderError(created.status);
    return { objectId, classId: config.classId };
  }

  if (!existing.ok) throw new GoogleWalletProviderError(existing.status);

  const patched = await walletRequest(
    resource,
    {
      method: "PATCH",
      body: JSON.stringify(googleObjectBody(snapshot, config, true)),
    },
    config,
  );
  if (!patched.ok) throw new GoogleWalletProviderError(patched.status);
  return { objectId, classId: config.classId };
}

export function buildGoogleWalletSaveUrl(
  objectId: string,
  config: GoogleWalletConfig,
): string {
  return buildSaveUrl(objectId, config);
}

export function safeGoogleWalletError(error: unknown): string {
  if (error instanceof GoogleWalletProviderError) {
    if (error.status === 401 || error.status === 403) {
      return "Google Wallet authorization failed.";
    }
    if (error.status === 404) return "Google Wallet resource was not found.";
  }
  return "Google Wallet request failed.";
}

export type { GoogleWalletMemberSnapshot, GoogleWalletProjection };
