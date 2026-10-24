import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseVersionCode, validateReleaseIdentity } from './release-identity.mjs';

test('year-minor codes remain ordered across a new year', () => {
  assert.equal(releaseVersionCode('2026-7'), 20260007);
  assert.ok(releaseVersionCode('2027-1') > releaseVersionCode('2026-9999'));
  for (const version of ['2026-0', '2026-01', '2026-10000', '1.0.0']) assert.throws(() => releaseVersionCode(version));
});

test('release identity rejects mismatched versions and accidental package migration', () => {
  const app = { version: '2026-7', android: { package: 'ninja.domi.cloudhoist', versionCode: 20260007 } };
  assert.equal(validateReleaseIdentity(app, '2026.7.0').unsignedApk, 'dist/cloud-hoist-2026-7-unsigned.apk');
  assert.throws(() => validateReleaseIdentity({ ...app, android: { ...app.android, versionCode: 20260008 } }, '2026.7.0'));
  assert.throws(() => validateReleaseIdentity(app, '2026.8.0'));
  assert.throws(() => validateReleaseIdentity({ ...app, android: { ...app.android, package: 'ninja.domi.cloudhoist.beta' } }, '2026.7.0'));
});
