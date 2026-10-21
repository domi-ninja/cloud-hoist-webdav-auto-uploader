import assert from 'node:assert/strict';
import test from 'node:test';
import { latestPublishedBuild, releaseVersionCode, releaseMetadata } from './github-release.mjs';

test('year-minor versions have one fixed, increasing Android code', () => {
  assert.equal(releaseVersionCode('2026-1'), 20260001);
  assert.equal(releaseVersionCode('2026-2'), 20260002);
  assert.equal(releaseVersionCode('2027-1'), 20270001);
  for (const value of ['2026-0', '2026-01', '2026-10000', '0.1.0', undefined]) assert.throws(() => releaseVersionCode(value));
});

test('release metadata binds the update feed to the APK name, Android package, and checksum', () => {
  const app = { name: 'Cloud Hoist', slug: 'cloud-hoist', version: '2026-1', android: { package: 'ninja.domi.cloudhoist', versionCode: 20260001 } };
  const release = releaseMetadata(app, 'domi-ninja/cloud-hoist-webdav-auto-uploader', 'a'.repeat(64));
  assert.equal(release.tag, 'v2026-1');
  assert.equal(release.fileName, 'cloud-hoist-2026-1.apk');
  assert.equal(release.manifest.androidPackage, app.android.package);
  assert.equal(release.manifest.sha256, 'a'.repeat(64));
  assert.equal(release.manifest.apkUrl, `https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/${release.tag}/${release.fileName}`);
  assert.throws(() => releaseMetadata({ ...app, slug: '../other' }, 'owner/repo', 'a'.repeat(64)));
  assert.throws(() => releaseMetadata(app, 'owner/repo', 'missing'));
});

test('the first release works without an existing feed, but network errors cannot reset the build number', async () => {
  assert.equal(await latestPublishedBuild('owner/repo', 'ninja.domi.cloudhoist', async () => new Response(null, { status: 404 })), 0);
  assert.equal(await latestPublishedBuild('owner/repo', 'ninja.domi.cloudhoist', async () => Response.json({ versionCode: 1005, androidPackage: 'ninja.domi.cloudhoist' })), 1005);
  await assert.rejects(latestPublishedBuild('owner/repo', 'ninja.domi.cloudhoist', async () => new Response(null, { status: 503 })));
  await assert.rejects(latestPublishedBuild('owner/repo', 'ninja.domi.cloudhoist', async () => Response.json({ versionCode: 1005, androidPackage: 'another.app' })));
});
