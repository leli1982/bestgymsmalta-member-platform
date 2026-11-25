import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("both member edit screens support retaking or uploading a photo and saving a photo alone", () => {
  for (const name of ["StaffMemberPersonalDetailsEditor", "SuperAdminMemberEditor"]) {
    const editor = read("components/staff/" + name + ".tsx");
    assert.match(editor, /<StaffRegistrationPhotoControls/);
    assert.match(editor, /onCaptured=\{setPhoto\}/);
    assert.match(editor, /onUploaded=\{setPhoto\}/);
    assert.match(editor, /!changed && !photo/);
    assert.match(editor, /if \(changed\)/);
    assert.match(editor, /if \(photo\)/);
    assert.match(editor, /body\.set\("memberId", memberId\)/);
    assert.match(editor, /body\.set\("file", photo\)/);
    assert.match(editor, /fetch\("\/api\/system\/members\/photo"/);
  }
  const controls = read("components/staff/StaffRegistrationPhotoControls.tsx");
  assert.match(controls, /Take Photo/);
  assert.match(controls, /Upload Image/);
  assert.match(controls, /image\/webp/);
});

test("photo replacement uses the existing permission and official photo provenance", () => {
  const api = read("app/api/system/members/photo/route.ts");
  assert.match(api, /requireSystemPermission\(request, "members.photos.capture"\)/);
  assert.match(api, /bgm_member_official_photos/);
  assert.match(api, /official_photo_path: previousPath/);
  assert.match(api, /official_photo_path: objectPath/);
});
