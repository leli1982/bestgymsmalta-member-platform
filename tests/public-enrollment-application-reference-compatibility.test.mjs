import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundationSql = readFileSync(
  "supabase/migrations/20260901_120000_phase2_operations_foundation.sql",
  "utf8",
);
const enrollmentSql = readFileSync(
  "supabase/migrations/20260916_130000_public_membership_enrollment.sql",
  "utf8",
);
const submissionSql = readFileSync(
  "supabase/migrations/20260916_131000_public_enrollment_submission.sql",
  "utf8",
);

test("public enrollment RPCs use the existing application_reference column", () => {
  assert.match(
    foundationSql,
    /application_reference\s+text\s+not\s+null/i,
    "the Phase 2 application table is defined with application_reference",
  );

  for (const [label, sql] of [
    ["public enrollment foundation", enrollmentSql],
    ["secure public submission", submissionSql],
  ]) {
    assert.match(
      sql,
      /insert\s+into\s+public\.bgm_membership_applications\s*\(\s*id\s*,\s*application_reference\s*,/i,
      `${label} must insert into the existing application_reference column`,
    );
    assert.doesNotMatch(
      sql,
      /insert\s+into\s+public\.bgm_membership_applications\s*\(\s*id\s*,\s*reference\s*,/i,
      `${label} must not invent a reference column`,
    );
  }
});
