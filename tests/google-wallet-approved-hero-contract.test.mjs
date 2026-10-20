import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const heroPath = fileURLToPath(new URL("../app/api/wallet-assets/hero/route.tsx", import.meta.url));
const serverPath = fileURLToPath(new URL("../lib/googleWalletServer.ts", import.meta.url));
const masterPath = fileURLToPath(new URL("../public/wallet/bgm-wallet-master-bg.jpg", import.meta.url));

const hero = readFileSync(heroPath, "utf8");
const server = readFileSync(serverPath, "utf8");

test("Google Wallet hero uses the user-approved master artwork at current Google hero proportions", () => {
  assert.ok(existsSync(masterPath), "approved Wallet master background must be committed");
  assert.match(hero, /bgm-wallet-master-bg\.jpg/);
  assert.match(hero, /width:\s*1032/);
  assert.match(hero, /height:\s*812/);
  assert.match(hero, /searchParams\.get\(["']membership["']\)/);
  assert.match(hero, /#111111/i);
  assert.match(hero, /#166534/i);
  assert.match(hero, /#B91C1C/i);
});

test("Google Wallet object requests a versioned hero for the current membership type", () => {
  assert.match(server, /projection\.theme\.type/);
  assert.match(server, /searchParams\.set\(["']membership["'],\s*membershipType\)/);
  assert.match(server, /searchParams\.set\(["']v["'],\s*["']3["']\)/);
});
