import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseVersionCode, validateReleaseIdentity } from './release-identity.mjs';
import appConfig from '../../app.config.ts';

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

test('beta is the default and F-Droid artifacts cannot overwrite beta artifacts', () => {
  const app = { version: '2026-10', android: { package: 'ninja.domi.cloudhoist', versionCode: 20260010 } };
  assert.equal(validateReleaseIdentity(app, '2026.10.0').apk, 'dist/cloud-hoist-2026-10.apk');
  assert.equal(validateReleaseIdentity(app, '2026.10.0', 'fdroid').apk, 'dist/fdroid/cloud-hoist-2026-10.apk');
  assert.throws(() => validateReleaseIdentity(app, '2026.10.0', 'typo'));
});

test('app configuration defaults to beta and requires an explicit valid production channel', () => {
  const previous = process.env.CLOUD_HOIST_CHANNEL;
  try {
    delete process.env.CLOUD_HOIST_CHANNEL;
    const context = { config: { name: 'Cloud Hoist', slug: 'cloud-hoist', version: '2026-10' } };
    assert.equal(appConfig(context).extra.updateChannel, 'beta');
    process.env.CLOUD_HOIST_CHANNEL = 'fdroid';
    assert.equal(appConfig(context).extra.updateChannel, 'fdroid');
    assert.equal(appConfig(context).version, '2026-10');
    process.env.CLOUD_HOIST_CHANNEL = 'typo';
    assert.throws(() => appConfig(context));
  } finally {
    if (previous === undefined) delete process.env.CLOUD_HOIST_CHANNEL;
    else process.env.CLOUD_HOIST_CHANNEL = previous;
  }
});
