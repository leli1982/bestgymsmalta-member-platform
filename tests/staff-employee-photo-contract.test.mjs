import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = "app/api/system/staff-employees/[employeeId]/photo/route.ts";

async function routeSource() {
  return readFile(routePath, "utf8");
}

test("staff photos use the private staff bucket and Super Admin authorization", async () => {
  const source = await routeSource();
  assert.match(source, /bgm-staff-photos/);
  assert.match(source, /requireSuperAdmin\s*\(/);
  assert.match(source, /export\s+async\s+function\s+GET\s*\(/);
  assert.match(source, /export\s+async\s+function\s+POST\s*\(/);
});

test("staff photo upload accepts only WebP up to five megabytes", async () => {
  const source = await routeSource();
  assert.match(source, /image\/webp/);
  assert.match(source, /5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /employees\/\$\{employeeId\}/);
});

test("staff photo replacement uploads first, rolls back failures, and removes old object last", async () => {
  const source = await routeSource();
  const uploadIndex = source.indexOf(".upload(");
  const updateIndex = source.indexOf('.from("bgm_staff_employees")', uploadIndex);
  const rollbackRemoveIndex = source.indexOf(".remove([objectPath])", updateIndex);
  const auditIndex = source.indexOf("staff.photo.updated");
  const oldCleanupIndex = source.indexOf(".remove([previousPath])", auditIndex);

  assert.ok(uploadIndex >= 0, "new object must upload first");
  assert.ok(updateIndex > uploadIndex, "employee photo_path updates only after upload");
  assert.ok(rollbackRemoveIndex > updateIndex, "failed record update removes the new object");
  assert.ok(auditIndex > updateIndex, "successful replacement is audited");
  assert.ok(oldCleanupIndex > auditIndex, "old object is removed only after replacement and audit succeed");
  assert.doesNotMatch(source, /base64|data:image/i);
});
