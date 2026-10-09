import { NextResponse } from "next/server";
import { getGoogleWalletConfig } from "@/lib/googleWalletServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
};

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
  }

  const privateKeyValue = env("GOOGLE_WALLET_PRIVATE_KEY").replace(/\\n/g, "\n");
  const issuerIdValue = env("GOOGLE_WALLET_ISSUER_ID");
  const serviceAccountEmailValue = env("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  const classSuffixValue = env("GOOGLE_WALLET_CLASS_SUFFIX");
  const objectPrefixValue = env("GOOGLE_WALLET_OBJECT_PREFIX");
  const originValue = env("GOOGLE_WALLET_ORIGIN");
  const logoUrlValue = env("GOOGLE_WALLET_LOGO_URL");
  const appUrlValue = env("GOOGLE_WALLET_APP_URL");

  let configValid = false;
  try {
    configValid = Boolean(getGoogleWalletConfig());
  } catch {
    configValid = false;
  }

  return NextResponse.json(
    {
      enabled: env("GOOGLE_WALLET_ENABLED") === "true",
      issuerIdPresent: Boolean(issuerIdValue),
      issuerIdValid: /^\d+$/.test(issuerIdValue),
      serviceAccountEmailPresent: Boolean(serviceAccountEmailValue),
      privateKeyPresent: Boolean(privateKeyValue),
      privateKeyPemMarker: privateKeyValue.includes("BEGIN PRIVATE KEY"),
      classSuffixPresent: Boolean(classSuffixValue),
      classSuffixValid: /^[A-Za-z0-9._-]+$/.test(classSuffixValue),
      objectPrefixPresent: Boolean(objectPrefixValue),
      objectPrefixValid: /^[A-Za-z0-9._-]+$/.test(objectPrefixValue),
      originHttps: isHttps(originValue),
      logoUrlHttps: isHttps(logoUrlValue),
      appUrlHttps: isHttps(appUrlValue),
      configValid,
    },
    { headers: NO_STORE },
  );
}
