import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
const route=fs.readFileSync("app/api/staff-hu20/enrollments/complete/route.ts","utf8");
const sql=fs.readFileSync("supabase/migrations/20261112_160000_hu20_test_single_use_encrypted_enrollment.sql","utf8");

test("HU20 TEST enrollment upload requires terminal authorization and encryption at rest", () => {
 assert.match(route,/isHu20TestRequestEnabled/);
 assert.match(route,/BGM_HU20_ENROLL_UPLOAD_ENABLED/);
 assert.match(route,/authenticateHu20Terminal\(request\)/);
 assert.match(route,/sealHu20Template\(template/);
 assert.match(route,/template\.fill\(0\)/);
 assert.match(route,/pending\.data\.terminal_id !== terminal\.id/);
 assert.match(route,/bgm_hu20_test_complete_enrollment/);
 assert.match(route,/attendanceEnabled: false/);
 assert.doesNotMatch(route,/recordStaffPunch|bgm_staff_record_punch|logger.*templateBase64/);
});

test("HU20 enrollment uses atomic, locked and audited single-use transaction with no public access", () => {
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/v_req.status <> 'pending'/);
 assert.match(sql,/INSERT INTO public\.bgm_staff_biometrics/);
 assert.match(sql,/UPDATE public\.bgm_hu20_enrollment_requests/);
 assert.match(sql,/INSERT INTO public\.bgm_audit_log/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION/);
 assert.match(sql,/TO service_role/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|bgm_staff_record_punch/);
});
