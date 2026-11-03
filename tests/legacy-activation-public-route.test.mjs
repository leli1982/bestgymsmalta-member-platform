import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/member/MemberAccessGate.tsx", import.meta.url), "utf8");

test("legacy activation route is public before a member session exists", () => {
  assert.match(
    source,
    /PUBLIC_PREFIXES\s*=\s*\[[\s\S]*["']\/legacy-activate["']/,
    "MemberAccessGate must allow /legacy-activate without an existing member session",
  );
});
