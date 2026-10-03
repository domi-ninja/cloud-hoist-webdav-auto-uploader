import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPublishDestination, publishBeta, publishConfigFromEnv, validatePublishConfig } from './publish.mjs';

test('builds the beta folder URL from dotenv variables without discarding the DAV root', () => {
  const env = {
    NEXTCLOUD_WEBDAV_URL: 'https://example.test/remote.php/dav/files/prime',
    NEXTCLOUD_USERNAME: 'prime', NEXTCLOUD_PASSWORD: 'secret', NEXTCLOUD_DIRECTORY: 'beta_apps',
  };
  assert.equal(publishConfigFromEnv(env).folderUrl, 'https://example.test/remote.php/dav/files/prime/beta_apps/');
  assert.equal(publishConfigFromEnv({ ...env, NEXTCLOUD_DIRECTORY: 'Beta apps/Android' }).folderUrl,
    'https://example.test/remote.php/dav/files/prime/Beta%20apps/Android/');
  assert.throws(() => publishConfigFromEnv({ ...env, NEXTCLOUD_DIRECTORY: '../other' }));
});

const config = validatePublishConfig({
  folderUrl: 'https://example.test/dav/Beta', username: 'tester', appPassword: 'secret',
});

test('rejects missing or unsafe app versions before accessing the APK or server', async () => {
  for (const version of [undefined, '', '../0.1.0', '0.1.0/other']) {
    await assert.rejects(publishBeta(config, 'unused.apk', { version, versionCode: 2 }), /Invalid app version/);
  }
});

test('rejects insecure URLs and keeps the destination inside the configured folder', () => {
  assert.equal(config.folderUrl, 'https://example.test/dav/Beta/');
  for (const folderUrl of ['http://example.test/', 'https://user:pass@example.test/', 'https://example.test/?token=secret']) {
    assert.throws(() => validatePublishConfig({ ...config, folderUrl }));
  }
});

test('preflight requires a WebDAV response and rejects authentication failures', async () => {
  await checkPublishDestination(config, async () => new Response('', { status: 207 }));
  await assert.rejects(checkPublishDestination(config, async () => new Response('', { status: 200 })), /not a WebDAV/);
  await assert.rejects(checkPublishDestination(config, async () => new Response('', { status: 401 })), /HTTP 401/);
});

test('creates only the configured destination when it is missing', async () => {
  const methods = [];
  await checkPublishDestination(config, async (url, options) => {
    assert.equal(url, config.folderUrl);
    methods.push(options.method);
    return new Response(null, { status: options.method === 'PROPFIND' ? 404 : 201 });
  });
  assert.deepEqual(methods, ['PROPFIND', 'MKCOL']);
});

for (const failure of [null, 'checksum', 'conflict', 'upload', 'refused']) {
  test(`publishing ${failure ?? 'success'} verifies bytes and never overwrites existing betas`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'beta-publish-test-'));
    try {
      const apk = join(directory, 'test.apk');
      await writeFile(apk, 'signed apk fixture');
      const builtAt = new Date('2026-10-04T01:52:19+06:00');
      await utimes(apk, builtAt, builtAt);
      const release = { version: '0.1.0', versionCode: 2 };
      const fileName = 'webdav-auto-upload-0.1.0-2026-10-03T195219Z-build-2.apk';
      const calls = [];
      let uploaded;
      const request = async (url, options) => {
        calls.push({ url, ...options });
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('tester:secret').toString('base64'));
        if (options.method === 'PUT') {
          assert.match(new URL(url).pathname, /\/\.beta-[a-f0-9-]+\.apk$/);
          const chunks = [];
          for await (const chunk of options.body) chunks.push(chunk);
          uploaded = Buffer.concat(chunks);
          if (failure === 'refused' && calls.filter(call => call.method === 'PUT').length === 1) {
            throw new Error('Connection refused', { cause: { code: 'ECONNREFUSED' } });
          }
          assert.equal(uploaded.toString(), 'signed apk fixture');
          assert.equal(options.headers['If-None-Match'], '*');
          return new Response(null, { status: failure === 'upload' ? 503 : 201 });
        }
        if (options.method === 'GET') return new Response(failure === 'checksum' ? 'broken' : uploaded);
        if (options.method === 'MOVE') {
          assert.equal(options.headers.Overwrite, 'F');
          assert.equal(options.headers.Destination, config.folderUrl + fileName);
          return new Response(null, { status: failure === 'conflict' ? 412 : 201 });
        }
        assert.equal(options.method, 'DELETE');
        return new Response(null, { status: 204 });
      };
      if (failure && failure !== 'refused') {
        await assert.rejects(publishBeta(config, apk, release, request));
        assert.equal(calls.at(-1).method, 'DELETE');
        assert.equal(calls.at(-1).url, calls[0].url);
        if (failure !== 'conflict') assert.ok(!calls.some(call => call.method === 'MOVE'));
      } else {
        const result = await publishBeta(config, apk, release, request);
        assert.equal(result.fileName, fileName);
        assert.deepEqual(calls.map(call => call.method), failure === 'refused'
          ? ['PUT', 'PUT', 'GET', 'MOVE'] : ['PUT', 'GET', 'MOVE']);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
