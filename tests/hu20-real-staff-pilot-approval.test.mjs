import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const get = (path) => fs.readFileSync(path, "utf8");
const api = get("app/api/system/staff-hu20/real-staff-pilot/route.ts");
const sql = get("supabase/test-only/hu20-real-staff-pilot-approval.sql");
const component = get("components/staff/Hu20RealStaffPilotApproval.tsx");
const staff = get("components/staff/StaffEmployeeDetail.tsx");

test("Super Admin real staff pilot approval must be explicit and TEST-only", () => {
  assert.match(api, /requireSuperAdmin\(request\)/g);
  assert.match(api, /isHu20TestRequestEnabled\(\)/);
  assert.match(api, /BGM_HU20_REAL_STAFF_PILOT_ENABLED/);
  assert.match(api, /request\.headers\.get\("origin"\)/);
  assert.match(api, /bgm_hu20_test_set_real_staff_pilot_approval/);
  assert.doesNotMatch(api, /sealHu20Template|openHu20Template|bgm_staff_record_punch/);
});
test("Approval is audited atomically and restricted to genuine active employees", () => {
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /id_number LIKE 'HU20-TEST-%'/);
  assert.match(sql, /v_employee\.active/);
  assert.match(sql, /pg_catalog\.jsonb_build_object/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
});
test("Employee UI cannot capture biometric data or request attendance", () => {
  assert.match(staff, /<Hu20RealStaffPilotApproval employeeId=\{e\.id\}/);
  assert.match(component, /noBiometricCapture/);
  assert.match(component, /Real fingerprint capture is still disabled/);
  assert.doesNotMatch(component, /\/enroll|\/recognition|\/attendance|127\.0\.0\.1/);
});
