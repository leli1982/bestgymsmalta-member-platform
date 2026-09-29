import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260916_121000_membership_declaration_seed.sql",
  "utf8"
);

const expectedRules = `1. No towel, no training. Towels are to be used on benches and machines at all times.
2. No heavy banging when using free weights.
3. Weights are to be replaced after use.
4. No loud talking or shouting.
5. Proper clothing and gym shoes must be worn.
6. Hygiene is of high importance, shower if you smell.
7. The management is not responsible for any theft.
8. The management is not responsible for any injuries.
9. Membership is not transferable or frozen for any reason what so ever.
10. Membership is not refundable
11. The management has the right to stop a membership if rules are not followed.`;

const expectedLegacyDeclaration = `I declare that the above details are correct and in the event of me being accepted, I undertake to abide by the Rules and Regulations set by the Management. I will not hold the Management responsible for the loss of or damage to my property/personal belongings within the confines of the BGM premises or grounds. I accept to exercise and use the facilities at my own risk with the prior consent of my doctor.`;

test("seed preserves the exact source-backed eleven Gym Rules", () => {
  assert.equal((expectedRules.match(/^\d+\. /gm) || []).length, 11);
  assert.match(sql, new RegExp(expectedRules.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sql, /ec5cb4a9c9faf43ea6df80e1975120a413fa75508be148dbbf45e8793161d5a9/);
});

test("seed preserves the exact legacy declaration and its hash", () => {
  assert.match(sql, new RegExp(expectedLegacyDeclaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sql, /601a2706d6fe136115c0c11ff894eb05500797031d7199a7522665c47b969ce3/);
});

test("only source-backed Gym Rules and legacy declaration are initially published", () => {
  assert.match(sql, /'gym_rules'/);
  assert.match(sql, /'legacy_declaration'/);
  assert.match(sql, /'published'/);
  assert.doesNotMatch(sql, /'privacy'\s*,\s*1\s*,/i);
  assert.doesNotMatch(sql, /'health'\s*,\s*1\s*,/i);
});

test("seed is idempotent and does not overwrite an existing historical version", () => {
  assert.match(sql, /on conflict\s*\(content_key,\s*version_no\)\s*do nothing/i);
});
