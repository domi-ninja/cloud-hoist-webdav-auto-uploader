import assert from 'node:assert/strict';
import test from 'node:test';
import { latestPublishedBuild, releaseBuildNumber, releaseMetadata } from './github-release.mjs';

test('release build numbers increase across CI runs, reruns, and higher published builds', () => {
  assert.equal(releaseBuildNumber('1', 3), 1001);
  assert.equal(releaseBuildNumber('2', 3), 1002);
  assert.equal(releaseBuildNumber('2', 3, 1002), 1003);
  assert.equal(releaseBuildNumber('1', 3, 2000), 2001);
  assert.equal(releaseBuildNumber('1', 2000), 2001);
  assert.throws(() => releaseBuildNumber(undefined, 3));
  assert.throws(() => releaseBuildNumber('0', 3));
  assert.throws(() => releaseBuildNumber('2100000000', 3));
});

test('release metadata binds the update feed to the APK name, Android package, and checksum', () => {
  const app = { name: 'Cloud Hoist', slug: 'cloud-hoist', version: '0.1.0', android: { package: 'ninja.domi.cloudhoist', versionCode: 1001 } };
  const release = releaseMetadata(app, 'domi-ninja/cloud-hoist-webdav-auto-uploader', 'a'.repeat(64));
  assert.equal(release.tag, 'android-build-1001');
  assert.equal(release.fileName, 'cloud-hoist-0.1.0-build-1001.apk');
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
