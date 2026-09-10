import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../components/admin/MembershipDataAdmin.tsx", import.meta.url),
  "utf8"
);

test("membership data UI makes import preview explicit", () => {
  assert.match(source, /Download XLSX/);
  assert.match(source, /Download CSV/);
  assert.match(source, /Preview Import/);
  assert.match(source, /Confirm Import/);
  assert.match(source, /Deletions/);
  assert.match(source, /\.xlsx,.csv/);
  assert.doesNotMatch(source, /Members not included.*removed/i);
});

test("confirm is blocked while conflicts or invalid rows remain", () => {
  assert.match(source, /conflictRows/);
  assert.match(source, /invalidRows/);
  assert.match(source, /disabled=/);
});
