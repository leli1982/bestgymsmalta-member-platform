import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverUrl = new URL("../lib/googleWalletServer.ts", import.meta.url);
const serverPath = fileURLToPath(serverUrl);
assert.ok(existsSync(serverPath), "googleWalletServer.ts must exist before server contract can pass");
const source = readFileSync(serverPath, "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Google auth dependency and server-only boundary are explicit", () => {
  assert.match(String(pkg.dependencies?.["google-auth-library"] || ""), /^\^?11\./);
  assert.match(source, /import\s+"server-only"/);
  assert.match(source, /from\s+"google-auth-library"/);
  assert.match(source, /https:\/\/www\.googleapis\.com\/auth\/wallet_object\.issuer/);
  assert.match(source, /https:\/\/walletobjects\.googleapis\.com\/walletobjects\/v1/);
});

test("configuration stays server-only and requires all enabled Wallet settings", () => {
  for (const name of [
    "GOOGLE_WALLET_ENABLED",
    "GOOGLE_WALLET_ISSUER_ID",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_WALLET_PRIVATE_KEY",
    "GOOGLE_WALLET_CLASS_SUFFIX",
    "GOOGLE_WALLET_OBJECT_PREFIX",
    "GOOGLE_WALLET_ORIGIN",
    "GOOGLE_WALLET_LOGO_URL",
    "GOOGLE_WALLET_APP_URL",
  ]) assert.ok(source.includes(name), `missing ${name}`);
  assert.doesNotMatch(source, /NEXT_PUBLIC_GOOGLE_WALLET/);
});

test("save link is an RS256 service-account JWT referencing an existing GenericObject", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const script = `
    const mod = await import(${JSON.stringify(serverUrl.href)});
    const config = mod.getGoogleWalletConfig();
    if (!config) throw new Error("config missing");
    console.log(JSON.stringify({ url: mod.buildGoogleWalletSaveUrl("123456789.test_member_abc", config) }));
  `;
  const child = spawnSync(process.execPath, [
    "--conditions=react-server",
    "--experimental-strip-types",
    "--input-type=module",
    "-e",
    script,
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      GOOGLE_WALLET_ENABLED: "true",
      GOOGLE_WALLET_ISSUER_ID: "123456789",
      GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "wallet-test@example.test",
      GOOGLE_WALLET_PRIVATE_KEY: pem.replace(/\n/g, "\\n"),
      GOOGLE_WALLET_CLASS_SUFFIX: "bgm_membership_test_v1",
      GOOGLE_WALLET_OBJECT_PREFIX: "test_",
      GOOGLE_WALLET_ORIGIN: "https://test.example.test",
      GOOGLE_WALLET_LOGO_URL: "https://test.example.test/logo.png",
      GOOGLE_WALLET_APP_URL: "https://test.example.test/card",
    },
  });
  assert.equal(child.status, 0, child.stderr);
  const { url } = JSON.parse(child.stdout.trim());
  assert.ok(url.startsWith("https://pay.google.com/gp/v/save/"));
  const token = url.slice("https://pay.google.com/gp/v/save/".length);
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  assert.ok(signaturePart);
  const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  const header = decode(headerPart);
  const payload = decode(payloadPart);
  assert.equal(header.alg, "RS256");
  assert.equal(payload.iss, "wallet-test@example.test");
  assert.equal(payload.aud, "google");
  assert.equal(payload.typ, "savetowallet");
  assert.deepEqual(payload.origins, ["https://test.example.test"]);
  assert.deepEqual(payload.payload.genericObjects, [{ id: "123456789.test_member_abc" }]);
  assert.equal(typeof payload.iat, "number");
});

test("REST lifecycle uses GET then create-on-404 and PATCH for existing objects", () => {
  assert.match(source, /genericClass\//);
  assert.match(source, /genericObject\//);
  assert.match(source, /method:\s*"GET"/);
  assert.match(source, /method:\s*"POST"/);
  assert.match(source, /method:\s*"PATCH"/);
  assert.match(source, /status\s*===\s*404/);
  assert.doesNotMatch(source, /method:\s*"PUT"/);
});

test("safe Google errors never echo tokens keys or raw provider bodies", () => {
  assert.match(source, /export function safeGoogleWalletError/);
  assert.doesNotMatch(source, /throw new Error\([^\n]*responseText/);
  assert.doesNotMatch(source, /console\.(log|error)\([^\n]*privateKey/);
});
