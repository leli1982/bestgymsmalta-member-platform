import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const read = (path) => fs.readFileSync(root + path, 'utf8');

test('admin help centre files exist and are wired into staff layout', () => {
  const layout = read('app/staff/layout.tsx');
  assert.match(layout, /AdminHelpCentre/);
  assert.match(layout, /<AdminHelpCentre\s*\/?>/);
  assert.ok(fs.existsSync(root + 'app/staff/admin/help/page.tsx'));
  assert.ok(fs.existsSync(root + 'components/admin/AdminHelpCentre.tsx'));
  assert.ok(fs.existsSync(root + 'components/admin/AdminHelpManualPage.tsx'));
});

test('admin help is restricted to super admins and points to full manual', () => {
  const centre = read('components/admin/AdminHelpCentre.tsx');
  const manual = read('components/admin/AdminHelpManualPage.tsx');
  assert.match(centre, /isSuperAdmin/);
  assert.match(centre, /\/staff\/admin\/help/);
  assert.match(manual, /isSuperAdmin/);
  assert.match(manual, /Super Admin access required|window\.location\.replace/);
});

test('admin help exposes safety levels and local search', () => {
  const content = [read('lib/adminHelpContent.ts'), read('lib/adminHelpOperations.ts'), read('lib/adminHelpManagement.ts'), read('lib/adminHelpMembership.ts')].join('\n');
  assert.match(content, /safety:\s*"green"/);
  assert.match(content, /safety:\s*"amber"/);
  assert.match(content, /safety:\s*"red"/);
  assert.match(content, /searchAdminHelpTopics/);
  assert.match(content, /getContextAdminHelpTopic/);
  assert.match(content, /Audit Trail/);
  assert.match(content, /Permanent Delete/);
  assert.match(content, /Membership Settings/);
});
