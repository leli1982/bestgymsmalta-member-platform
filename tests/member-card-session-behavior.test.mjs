import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import bcrypt from "bcryptjs";
import ts from "typescript";
import { NextRequest } from "next/server.js";
import * as memberSessionCore from "../lib/memberServerSession.ts";
import * as memberNumbers from "../lib/memberNumberCore.ts";
import * as memberProfiles from "../lib/memberPublicProfile.ts";
import { resolveMemberCardResponse } from "../lib/memberCardState.ts";

const require = createRequire(import.meta.url);
const testSecret = "member-session-regression-test-only";
const password = "member-session-test-password";
const member = {
  id: "00000000-0000-4000-8000-000000000001", username: "test-member",
  member_number: "BGM0000123", full_name: "Test Member", email: "member@example.test",
  status: "active", membership_expiry: "9999-12-31", app_enrolled: true,
  password_hash: bcrypt.hashSync(password, 4),
};
const credential = { member_id: member.id, barcode_value: "NEW001aB", status: "active" };

function loadModule(path, dependencies) {
  const source = fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    exports: module.exports, module,
    console: { error() {} },
    process: { env: { NODE_ENV: "production", BGM_MEMBER_SESSION_SECRET: testSecret } },
    require(specifier) {
      if (specifier in dependencies) return dependencies[specifier];
      if (specifier === "next/server" || specifier === "bcryptjs") return require(specifier);
      throw new Error("Unexpected dependency: " + specifier);
    },
  });
  return module.exports;
}

function harness({ credentials = [credential], databaseError = false } = {}) {
  const queries = [];
  const database = {
    from(table) {
      return {
        select(columns) {
          return {
            eq(column, value) {
              queries.push({ table, columns, column, value });
              return {
                async maybeSingle() {
                  return {
                    data: member[column] === value ? member : null,
                    error: databaseError ? new Error("Database unavailable") : null,
                  };
                },
                async order() {
                  return {
                    data: credentials.filter((row) => row.member_id === value),
                    error: databaseError ? new Error("Database unavailable") : null,
                  };
                },
              };
            },
          };
        },
        update() { return { async eq() { return { error: null }; } }; },
      };
    },
  };
  const auth = loadModule("lib/memberAuth.ts", { "@/lib/memberServerSession": memberSessionCore });
  const dependencies = {
    "@/lib/memberAuth": auth,
    "@/lib/supabaseAdmin": { getSupabaseAdmin: () => database },
    "@/lib/memberPublicProfile": memberProfiles,
    "@/lib/memberNumberCore": memberNumbers,
  };
  return {
    queries,
    card: loadModule("app/api/member/card/route.ts", dependencies).GET,
    session: loadModule("app/api/member/auth/session/route.ts", dependencies).GET,
    login: loadModule("app/api/member/auth/login/route.ts", dependencies).POST,
  };
}

function request(path = "/api/member/card", token) {
  return new NextRequest("https://example.test" + path, {
    headers: token ? { cookie: "bgm_member_session=" + token } : {},
  });
}
function validToken() {
  return memberSessionCore.createMemberSessionToken(member.id, testSecret);
}

test("missing login cannot expose a card or use a supplied member id", async () => {
  const app = harness();
  const response = await app.card(request("/api/member/card?memberId=" + member.id));
  assert.equal(response.status, 401);
  assert.equal(app.queries.length, 0);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(resolveMemberCardResponse(response.status, await response.json()).kind, "signed-out");
});

test("expired and tampered cookies are rejected before any member lookup", async () => {
  const app = harness();
  const expired = memberSessionCore.createMemberSessionToken(member.id, testSecret, { now: 1, ttlMs: 1 });
  for (const token of [expired, validToken() + "tampered"]) {
    assert.equal((await app.card(request("/api/member/card", token))).status, 401);
    assert.equal((await app.session(request("/api/member/auth/session", token))).status, 401);
  }
  assert.equal(app.queries.length, 0);
});

test("real login cookie restores the profile and current card without any local cache", async () => {
  const app = harness();
  const response = await app.login(new NextRequest("https://example.test/api/member/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: member.username, password }),
  }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=strict/i);
  const headers = { cookie: cookie.split(";")[0] };
  const profileResponse = await app.session(new NextRequest("https://example.test/api/member/auth/session", { headers }));
  assert.equal(profileResponse.status, 200);
  assert.equal((await profileResponse.json()).member.id, member.id);
  const cardResponse = await app.card(new NextRequest("https://example.test/api/member/card?memberId=other-member", { headers }));
  assert.equal(cardResponse.status, 200);
  const data = await cardResponse.json();
  assert.equal(data.member.id, member.id);
  assert.equal(data.cardBarcode, member.member_number);
  assert.equal(data.physicalCardBarcode, credential.barcode_value);
  assert.equal(data.cardLinked, true);
  assert.equal(data.member.password_hash, undefined);
  assert.equal(data.member.app_enrolled, undefined);
  assert.equal(resolveMemberCardResponse(200, data).kind, "ready");
  assert.equal(app.queries.filter((q) => q.table === "bgm_member_card_credentials").every((q) => q.value === member.id), true);
});

test("a retired physical card never removes the permanent virtual BGM barcode", async () => {
  const app = harness({ credentials: [{ ...credential, status: "revoked" }] });
  const response = await app.card(request("/api/member/card", validToken()));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.cardLinked, false);
  assert.equal(data.cardBarcode, member.member_number);
  assert.equal(data.physicalCardBarcode, null);
  assert.deepEqual(resolveMemberCardResponse(200, data), {
    kind: "ready",
    member: data.member,
    cardLinked: false,
    cardBarcode: member.member_number,
    physicalCardBarcode: "",
  });
});

test("members with no physical credential still receive their permanent BGM virtual barcode", async () => {
  const app = harness({ credentials: [] });
  const response = await app.card(request("/api/member/card", validToken()));
  const data = await response.json();
  assert.equal(data.cardBarcode, member.member_number);
  assert.equal(data.cardLinked, false);
  assert.equal(data.physicalCardBarcode, null);
  assert.equal(data.source, "member_number");
});

test("database errors are unavailable cards and never CARD NOT LINKED", async () => {
  const app = harness({ databaseError: true });
  const response = await app.card(request("/api/member/card", validToken()));
  assert.equal(response.status, 500);
  assert.equal(resolveMemberCardResponse(response.status, await response.json()).kind, "unavailable");
  assert.equal((await app.session(request("/api/member/auth/session", validToken()))).status, 500);
});

test("only a successful verified card response can display a barcode or an unlinked card", () => {
  const staleProfile = { ...memberProfiles.publicMemberProfile(member), id: "stale-local-member" };
  const cached = { member: staleProfile, cardLinked: true, cardBarcode: "OLD" };
  assert.equal(resolveMemberCardResponse(401, cached).kind, "signed-out");
  assert.equal(resolveMemberCardResponse(404, cached).kind, "signed-out");
  assert.equal(resolveMemberCardResponse(500, cached).kind, "unavailable");
  assert.equal(resolveMemberCardResponse(200, null).kind, "unavailable");
  assert.equal(resolveMemberCardResponse(200, { cardLinked: false }).kind, "unavailable");
  assert.equal(resolveMemberCardResponse(200, { ...cached, cardBarcode: "" }).kind, "unavailable");
});
