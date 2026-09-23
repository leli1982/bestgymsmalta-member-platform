import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("official member photo saves only after member row is updated and image retrieval verified", () => {
  const upload = read("app/api/system/members/photo/route.ts");
  const capture = read("components/staff/OfficialMemberPhotoCapture.tsx");
  assert.match(upload, /\.select\("id, official_photo_path"\)\s*\.maybeSingle\(\)/);
  assert.match(upload, /updateResult\.data\.official_photo_path !== objectPath/);
  assert.match(upload, /\?inline=1&v=/);
  assert.match(capture, /photoResponse\.ok/);
  assert.match(capture, /photoResponse\.headers\.get\("content-type"\)/);
  assert.match(capture, /imageBytes\.size === 0/);
  assert.match(capture, /onSaved\?\.\(data\.photoUrl\)/);
  assert.match(capture, /Keep PHOTO REQUIRED visible/);
});

test("authenticated photo bytes are private and not cached by browser", () => {
  const photoGet = read("app/api/system/members/photo/[memberId]/route.ts");
  assert.match(photoGet, /requireSystemPermission\(request, "members\.photos\.view"\)/);
  assert.match(photoGet, /request\.nextUrl\.searchParams\.get\("inline"\) === "1"/);
  assert.match(photoGet, /Cache-Control": "private, no-store, max-age=0"/);
  const scan = read("app/api/system/barcode/scan/route.ts");
  assert.match(scan, /\?inline=1`/);
});

test("reception, Staff Home and global scanner keep capture action available when photo fails", () => {
  for (const path of [
    "components/staff/BarcodeReceptionPage.tsx",
    "components/staff/StaffHomeScanner.tsx",
    "components/staff/StaffGlobalScanner.tsx",
  ]) {
    const ui = read(path);
    assert.match(ui, /OfficialMemberPhotoCapture/, path);
    assert.match(ui, /photoLoadFailed/, path);
    assert.match(ui, /setPhotoLoadFailed\(true\)/, path);
    assert.match(ui, /source="reception_capture"/, path);
    assert.match(ui, /photoRequired: false,/, path);
  }
});
