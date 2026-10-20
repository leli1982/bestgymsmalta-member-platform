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
  logoUrl?: string;
  wideLogoUrl?: string;
  heroImageUrl?: string;
  appUrl: string;
  classId: string;
};

type WalletResponse = {
  status: number;
  ok: boolean;
  data: unknown;
};

function providerErrorDetail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const error = (data as { error?: Record<string, unknown> }).error;
  if (!error || typeof error !== "object") return null;

  const parts: string[] = [];
  if (typeof error.code === "number" || typeof error.code === "string") {
    parts.push(`code=${String(error.code).slice(0, 40)}`);
  }
  if (typeof error.status === "string") {
    parts.push(`status=${error.status.slice(0, 80)}`);
  }
  if (typeof error.message === "string") {
    const message = error.message.replace(/[\r\n\t]+/g, " ").trim().slice(0, 300);
    if (message) parts.push(`message=${message}`);
  }

  return parts.length ? parts.join("; ").slice(0, 300) : null;
}

class GoogleWalletProviderError extends Error {
  status: number | null;
  detail: string | null;

  constructor(status: number | null, data: unknown = null) {
    super("Google Wallet provider request failed.");
    this.name = "GoogleWalletProviderError";
    this.status = status;
    this.detail = providerErrorDetail(data);
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

function templateItem(fieldPath: string) {
  return {
    firstValue: {
      fields: [{ fieldPath }],
    },
  };
}

function barcodeDetail(fieldPath: string) {
  return {
    fieldSelector: {
      fields: [{ fieldPath }],
    },
  };
}

function googleClassBody(config: GoogleWalletConfig): Record<string, unknown> {
  return {
    id: config.classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            threeItems: {
              startItem: templateItem("object.textModulesData['membership_type']"),
              middleItem: templateItem("object.textModulesData['membership_status']"),
              endItem: templateItem("object.textModulesData['membership_expiry']"),
            },
          },
        ],
      },
      cardBarcodeSectionDetails: {
        firstTopDetail: barcodeDetail("object.textModulesData['member_number']"),
      },
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
    subheader: localized(`${projection.theme.label} membership`),
    header: localized(snapshot.fullName || "BGM Member"),
    hexBackgroundColor: projection.theme.background,
    barcode,
    textModulesData: [
      {
        id: "membership_type",
        header: "Membership type",
        body: projection.theme.label,
      },
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

  if (config.logoUrl) {
    body.logo = {
      sourceUri: { uri: config.logoUrl },
      contentDescription: localized("BestGymsMalta member pass icon"),
    };
  }

  if (config.wideLogoUrl) {
    body.wideLogo = {
      sourceUri: { uri: config.wideLogoUrl },
      contentDescription: localized("BestGymsMalta official logo"),
    };
  }

  if (config.heroImageUrl) {
    body.heroImage = {
      sourceUri: { uri: config.heroImageUrl },
      contentDescription: localized("BestGymsMalta — Be the best, beat the rest"),
    };
  }

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
  const wideLogoUrl = env("GOOGLE_WALLET_WIDE_LOGO_URL");
  const heroImageUrl = env("GOOGLE_WALLET_HERO_IMAGE_URL");
  const appUrl = env("GOOGLE_WALLET_APP_URL");

  if (
    !issuerId ||
    !serviceAccountEmail ||
    !privateKey ||
    !classSuffix ||
    !objectPrefix ||
    !origin ||
    !appUrl
  ) {
    throw new Error("Google Wallet is not fully configured.");
  }
  if (!/^\d+$/.test(issuerId)) throw new Error("Google Wallet issuer ID is invalid.");
  if (!/^[A-Za-z0-9._-]+$/.test(classSuffix)) throw new Error("Google Wallet class suffix is invalid.");
  if (!/^[A-Za-z0-9._-]+$/.test(objectPrefix)) throw new Error("Google Wallet object prefix is invalid.");
  if (!privateKey.includes("BEGIN PRIVATE KEY")) throw new Error("Google Wallet private key is invalid.");

  const trustedOrigin = httpsUrl("origin", origin);
  const trustedLogoUrl = logoUrl ? httpsUrl("logo URL", logoUrl) : undefined;
  const trustedWideLogoUrl = wideLogoUrl ? httpsUrl("wide logo URL", wideLogoUrl) : undefined;
  const trustedHeroImageUrl = heroImageUrl ? httpsUrl("hero image URL", heroImageUrl) : undefined;
  const trustedAppUrl = httpsUrl("app URL", appUrl);

  return {
    issuerId,
    serviceAccountEmail,
    privateKey,
    classSuffix,
    objectPrefix,
    origin: trustedOrigin,
    logoUrl: trustedLogoUrl,
    wideLogoUrl: trustedWideLogoUrl,
    heroImageUrl: trustedHeroImageUrl,
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

  if (existing.ok) {
    const patched = await walletRequest(
      resource,
      {
        method: "PATCH",
        body: JSON.stringify(googleClassBody(config)),
      },
      config,
    );
    if (patched.ok) return config.classId;
    throw new GoogleWalletProviderError(patched.status, patched.data);
  }

  if (existing.status === 404) {
    const created = await walletRequest(
      "genericClass",
      {
        method: "POST",
        body: JSON.stringify(googleClassBody(config)),
      },
      config,
    );
    if (created.ok) return config.classId;
    throw new GoogleWalletProviderError(created.status, created.data);
  }
  throw new GoogleWalletProviderError(existing.status, existing.data);
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
    if (!created.ok) throw new GoogleWalletProviderError(created.status, created.data);
    return { objectId, classId: config.classId };
  }

  if (!existing.ok) throw new GoogleWalletProviderError(existing.status, existing.data);

  const patched = await walletRequest(
    resource,
    {
      method: "PATCH",
      body: JSON.stringify(googleObjectBody(snapshot, config, true)),
    },
    config,
  );
  if (!patched.ok) throw new GoogleWalletProviderError(patched.status, patched.data);
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
    const detail = error.detail ? ` ${error.detail}` : "";
    if (error.status === 401 || error.status === 403) {
      return `Google Wallet authorization failed.${detail}`.slice(0, 420);
    }
    if (error.status === 404) {
      return `Google Wallet resource was not found.${detail}`.slice(0, 420);
    }
    const status = error.status ? ` HTTP ${error.status}.` : "";
    return `Google Wallet request failed.${status}${detail}`.slice(0, 420);
  }
  return "Google Wallet request failed.";
}

export type { GoogleWalletMemberSnapshot, GoogleWalletProjection };
