import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const content = ['adminHelpContent.ts','adminHelpOperations.ts','adminHelpManagement.ts','adminHelpMembership.ts'].map((name) => fs.readFileSync(new URL('../lib/' + name, import.meta.url), 'utf8')).join('\n');

test('manual covers all current Super Admin dashboard entry points', () => {
  const required = [
    'Operations dashboard','End of Day','Shopping List','Bar Reports','Statistics & Analytics','Audit Trail',
    'Announcements','Notifications','Gym locations','Super Admin accounts','Gym Manager accounts','Staff Portal logins',
    'Bar catalogue & prices','Members','Member import & export','Card Conflict Review','New membership','Renew','Waiting',
    'Reception tools','Membership Settings'
  ];
  for (const label of required) assert.match(content, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('dangerous workflows carry explicit final-check language', () => {
  for (const phrase of ['Cancel an individual membership','Cancel a Couples membership','Archive, Restore or Permanent Delete','Voucher correction after payment']) {
    assert.match(content, new RegExp(phrase));
  }
  assert.match(content, /read the on-screen confirmation/i);
  assert.match(content, /BGM Member Number.*permanent/i);
});
