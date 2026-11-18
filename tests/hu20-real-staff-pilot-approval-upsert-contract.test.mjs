import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const original = fs.readFileSync("supabase/test-only/hu20-real-staff-pilot-approvals.sql","utf8");
const repair = fs.readFileSync("supabase/test-only/hu20-real-staff-pilot-approval-ambiguity-fix.sql","utf8");
const all = [original,repair];

test("HU20 pilot approval upsert uses named primary key, not ambiguous output employee_id", () => {
  for (const sql of all) {
    assert.match(sql,/RETURNS TABLE\(employee_id uuid, enabled boolean\)/);
    assert.match(sql,/ON CONFLICT ON CONSTRAINT bgm_hu20_real_staff_pilot_pkey DO UPDATE/);
    assert.doesNotMatch(sql,/ON CONFLICT \(employee_id\) DO UPDATE/);
    assert.match(sql,/bgm_hu20_pilot_set_employee_enabled/);
    assert.match(sql,/ENABLED|enabled/);
    assert.match(sql,/encrypted_template=NULL/);
    assert.match(sql,/bgm_audit_log/);
    assert.match(sql,/REVOKE ALL ON FUNCTION/);
    assert.match(sql,/TO service_role/);
  }
});
