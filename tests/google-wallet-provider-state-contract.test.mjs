import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(
  new URL("../lib/googleWalletProviderState.ts", import.meta.url),
);
const diagnosticRoutePath = fileURLToPath(
  new URL("../app/api/wallet-debug/provider-state/route.ts", import.meta.url),
);

test("TEST-only Wallet diagnostics can inspect Google's stored class and object without exposing credentials", () => {
  assert.ok(existsSync(helperPath), "provider-state diagnostic helper must exist");
  const helper = readFileSync(helperPath, "utf8");
  assert.match(helper, /export async function getGoogleWalletProviderState/);
  assert.match(helper, /genericObject\//);
  assert.match(helper, /genericClass\//);
  assert.match(helper, /heroImage/);
  assert.match(helper, /wideLogo/);
  assert.match(helper, /logo/);
  assert.doesNotMatch(helper, /console\.(log|error)/);

  assert.ok(existsSync(diagnosticRoutePath), "TEST provider-state diagnostic route must exist");
  const route = readFileSync(diagnosticRoutePath, "utf8");
  assert.match(route, /VERCEL_ENV/);
  assert.match(route, /production/);
  assert.match(route, /55a289ff-03a8-4b5c-a7a3-d21c2f626d92/);
  assert.match(route, /getGoogleWalletProviderState/);
  assert.doesNotMatch(route, /privateKey|serviceAccountEmail|Authorization/);
});
