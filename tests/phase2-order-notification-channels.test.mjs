import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901_125000_phase2_order_notification_channels.sql"
);

test("order notification migration tracks email and push delivery separately", () => {
  assert.equal(fs.existsSync(migrationPath), true, "Order notification-channel migration must exist");
  const sql = fs.readFileSync(migrationPath, "utf8");

  for (const column of [
    "email_notification_status",
    "email_notification_sent_at",
    "email_notification_error",
    "push_notification_status",
    "push_notification_sent_at",
    "push_notification_error",
  ]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}\\b`, "i"));
  }
});
