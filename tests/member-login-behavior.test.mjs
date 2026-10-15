import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import bcrypt from "bcryptjs";
import ts from "typescript";
import * as memberNumbers from "../lib/memberNumberCore.ts";
import { todayMaltaDate } from "../lib/maltaDate.ts";
import { isCancellationEffective } from "../lib/memberCancellationCore.ts";

const require = createRequire(import.meta.url);
const password = "login-regression-test-only";
const passwordHash = bcrypt.hashSync(password, 4);
const routeCode = ts.transpileModule(
  fs.readFileSync(new URL("../app/api/member/auth/login/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }
).outputText;

function member(id, memberNumber, overrides = {}) {
  return {
    id,
    username: `user-${id}`,
    member_number: memberNumber,
    password_hash: passwordHash,
    app_enrolled: true,
    status: "active",
    membership_expiry: "9999-12-31",
    ...overrides,
  };
}

function fakeAccess(row) {
  const today = todayMaltaDate();
  const locked = row.status !== "active"
    || isCancellationEffective(row.cancellation_effective_date, today)
    || Boolean(row.membership_expiry && row.membership_expiry < "2000-01-10");
  return {
    state: locked ? "locked" : "active",
    daysUntilExpiry: 0,
    graceDaysRemaining: 0,
    reminderDue: false,
  };
}

// Run the real route and password comparison. Replace only the database,
// access resolver and session-writing boundaries so these tests cannot access
// or modify real members.
function loginHarness(members) {
  const sessions = [];
  const database = {
    from(table) {
      assert.equal(table, "bgm_members");
      return {
        select() {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  return { data: members.find((row) => row[column] === value) ?? null, error: null };
                },
              };
            },
          };
        },
        update() {
          return { async eq() { return { error: null }; } };
        },
      };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(routeCode, {
    exports: module.exports,
    module,
    console,
    require(specifier) {
      if (specifier === "@/lib/supabaseAdmin") return { getSupabaseAdmin: () => database };
      if (specifier === "@/lib/memberNumberCore") return memberNumbers;
      if (specifier === "@/lib/maltaDate") return { todayMaltaDate };
      if (specifier === "@/lib/memberCancellationCore") return { isCancellationEffective };
      if (specifier === "@/lib/memberAppAccess") return { resolveMemberAppAccess: async (row) => fakeAccess(row) };
      if (specifier === "@/lib/memberAuth") {
        return {
          setMemberSessionCookie(response, memberId) {
            sessions.push(memberId);
            return response;
          },
        };
      }
      if (specifier === "next/server" || specifier === "bcryptjs") return require(specifier);
      throw new Error(`Unexpected route dependency: ${specifier}`);
    },
  });
  return {
    sessions,
    login(value, suppliedPassword = password) {
      return module.exports.POST(new Request("https://example.test/api/member/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: value, password: suppliedPassword }),
      }));
    },
  };
}

test("opaque card identifiers reject a case-changed match", async () => {
  const app = loginHarness([member("upper", "CARDX")]);
  assert.equal((await app.login("cardx")).status, 401);
  assert.deepEqual(app.sessions, []);
});

test("nonlegacy BGM-prefixed cards also require exact casing", async () => {
  const app = loginHarness([member("custom", "BGM-CUSTOM")]);
  assert.equal((await app.login("bgm-custom")).status, 401);
  assert.deepEqual(app.sessions, []);
});

test("exact mixed-case cards select the correct member", async () => {
  const app = loginHarness([member("upper", "0012AB"), member("mixed", "0012aB")]);
  const response = await app.login("0012aB");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).member.id, "mixed");
  assert.deepEqual(app.sessions, ["mixed"]);
});

test("numeric card identifiers retain leading zeros", async () => {
  const app = loginHarness([member("short", "12345"), member("padded", "0012345")]);
  const response = await app.login(" 0012345 ");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).member.id, "padded");
});

test("lowercase canonical BGM identifiers remain supported", async () => {
  const app = loginHarness([member("canonical", "BGM1003")]);
  const response = await app.login("bgm1003");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).member.id, "canonical");
});

test("usernames remain case-insensitive", async () => {
  const app = loginHarness([member("named", "2468", { username: "testmember" })]);
  const response = await app.login("TestMember");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).member.id, "named");
});

test("an exact identifier still requires the correct password", async () => {
  const app = loginHarness([member("secured", "CARDX")]);
  assert.equal((await app.login("CARDX", "wrong-password")).status, 401);
  assert.deepEqual(app.sessions, []);
});

test("inactive and expired enrolled members authenticate into locked renewal state", async () => {
  const app = loginHarness([
    member("inactive", "CARD1", { status: "inactive" }),
    member("expired", "CARD2", { membership_expiry: "2000-01-01" }),
  ]);
  const inactive = await app.login("CARD1");
  const expired = await app.login("CARD2");
  assert.equal(inactive.status, 200);
  assert.equal(expired.status, 200);
  assert.equal((await inactive.json()).access.state, "locked");
  assert.equal((await expired.json()).access.state, "locked");
  assert.deepEqual(app.sessions, ["inactive", "expired"]);
});
