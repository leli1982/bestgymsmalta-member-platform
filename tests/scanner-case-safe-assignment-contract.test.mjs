import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const scanner = read("app/api/system/barcode/scan/route.ts");
const reserve = read("app/api/system/members/card/assign/route.ts");
const replace = read("app/api/system/members/card/replace/route.ts");
const global = read("components/staff/StaffGlobalScanner.tsx");
const sql = read("supabase/migrations/20261126164200_scanner_case_safe_card_assignment.sql");

test("card assignment matches literal values case-insensitively and rejects multiple live owners", () => {
  assert.match(reserve, /ilike\("barcode_value", exactCaseInsensitivePattern\(barcode\)\)/);
  assert.match(reserve, /if \(liveMatches\.length > 1\)/);
  assert.match(reserve, /verifiedBarcode = existingBarcode\.barcode_value/);
  assert.match(reserve, /renewal_scanned_barcode: verifiedBarcode/);
  assert.match(reserve, /verifiedBarcode = reservedBarcode/);
});

test("obvious concatenated X-series card inputs are rejected before writes", () => {
  for (const route of [reserve, replace]) {
    assert.match(route, /if \(isConcatenatedPhysicalBarcode\(barcode\)\)/);
  }
  assert.ok(sql.includes("^(X[0-9]+){2,}$"));
});

test("database guard serializes matching new card writes while preserving historical rows", () => {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /upper\(c\.barcode_value\)=upper\(new\.barcode_value\)/);
  assert.match(sql, /c\.id is distinct from new\.id/);
  assert.match(sql, /new\.status not in \('active','reserved'\) then return new/);
  assert.doesNotMatch(sql, /delete from public\.bgm_member_card_credentials/i);
});

test("scan diagnostics distinguish manual dialog and scanner-like keyboard paths without claiming hardware proof", () => {
  for (const field of ["original_credential_value","normalized_credential_value","scan_input_source","lookup_kind"]) {
    assert.ok(scanner.includes(field));
    assert.ok(sql.includes("add column if not exists " + field));
  }
  assert.match(global, /queuedCodes\.current\.push\(\{ code, inputSource: "manual_dialog" \}\)/);
  assert.match(global, /submit\(code, "keyboard_prefix"\)/);
  assert.match(global, /submit\(code, "keyboard_burst"\)/);
  assert.match(global, /verify\(entry\.code, entry\.inputSource\)/);
});
