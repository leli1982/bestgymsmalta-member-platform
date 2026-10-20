import "server-only";

import { JWT } from "google-auth-library";
import { googleWalletObjectId } from "./googleWalletCore.ts";
import { getGoogleWalletConfig } from "./googleWalletServer.ts";

const WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function sourceUri(value: unknown): string | null {
  const image = record(value);
  const source = record(image?.sourceUri);
  return typeof source?.uri === "string" ? source.uri : null;
}

function localizedValue(value: unknown): string | null {
  const localized = record(value);
  const translated = record(localized?.defaultValue);
  return typeof translated?.value === "string" ? translated.value : null;
}

function textModules(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = record(entry);
    return {
      id: typeof item?.id === "string" ? item.id : null,
      header: typeof item?.header === "string" ? item.header : null,
      body: typeof item?.body === "string" ? item.body : null,
    };
  });
}

async function providerGet(resource: string, token: string): Promise<RecordValue> {
  const response = await fetch(`${WALLET_API}/${resource}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Wallet diagnostic GET failed with HTTP ${response.status}.`);
  }

  const data = await response.json();
  const body = record(data);
  if (!body) throw new Error("Google Wallet diagnostic response was invalid.");
  return body;
}

export async function getGoogleWalletProviderState(memberId: string) {
  const config = getGoogleWalletConfig();
  if (!config) throw new Error("Google Wallet is disabled.");

  const auth = new JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: [WALLET_SCOPE],
  });
  const token = (await auth.getAccessToken())?.token;
  if (!token) throw new Error("Google Wallet diagnostic authorization failed.");

  const objectId = googleWalletObjectId(
    config.issuerId,
    memberId,
    config.objectPrefix,
  );

  const [objectBody, classBody] = await Promise.all([
    providerGet(`genericObject/${encodeURIComponent(objectId)}`, token),
    providerGet(`genericClass/${encodeURIComponent(config.classId)}`, token),
  ]);

  const barcode = record(objectBody.barcode);

  return {
    expected: {
      objectId,
      classId: config.classId,
      logoUrl: config.logoUrl ?? null,
      wideLogoUrl: config.wideLogoUrl ?? null,
      heroImageUrl: config.heroImageUrl ?? null,
    },
    object: {
      id: typeof objectBody.id === "string" ? objectBody.id : null,
      classId: typeof objectBody.classId === "string" ? objectBody.classId : null,
      state: typeof objectBody.state === "string" ? objectBody.state : null,
      cardTitle: localizedValue(objectBody.cardTitle),
      subheader: localizedValue(objectBody.subheader),
      header: localizedValue(objectBody.header),
      hexBackgroundColor:
        typeof objectBody.hexBackgroundColor === "string"
          ? objectBody.hexBackgroundColor
          : null,
      logo: sourceUri(objectBody.logo),
      wideLogo: sourceUri(objectBody.wideLogo),
      heroImage: sourceUri(objectBody.heroImage),
      barcodeType: typeof barcode?.type === "string" ? barcode.type : null,
      textModulesData: textModules(objectBody.textModulesData),
      validTimeInterval: objectBody.validTimeInterval ?? null,
      hasUsers: objectBody.hasUsers === true,
    },
    class: {
      id: typeof classBody.id === "string" ? classBody.id : null,
      classTemplateInfo: classBody.classTemplateInfo ?? null,
    },
  };
}
