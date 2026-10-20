import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("../lib/googleWalletServer.ts", import.meta.url));
const diagnosticRoutePath = fileURLToPath(
  new URL("../app/api/wallet-debug/provider-state/route.ts", import.meta.url),
);
const source = readFileSync(serverPath, "utf8");

test("TEST-only Wallet diagnostics can inspect Google's stored class and object without exposing credentials", () => {
  assert.match(source, /export async function getGoogleWalletProviderState/);
  assert.match(source, /genericObject\//);
  assert.match(source, /genericClass\//);
  assert.match(source, /heroImage/);
  assert.match(source, /wideLogo/);
  assert.match(source, /logo/);
  assert.ok(existsSync(diagnosticRoutePath), "TEST provider-state diagnostic route must exist");

  const route = readFileSync(diagnosticRoutePath, "utf8");
  assert.match(route, /VERCEL_ENV/);
  assert.match(route, /production/);
  assert.match(route, /55a289ff-03a8-4b5c-a7a3-d21c2f626d92/);
  assert.match(route, /getGoogleWalletProviderState/);
  assert.doesNotMatch(route, /privateKey|serviceAccountEmail|Authorization/);
});
