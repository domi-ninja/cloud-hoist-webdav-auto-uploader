import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPublishDestination, publishBeta, validatePublishConfig } from './publish.mjs';

const config = validatePublishConfig({
  folderUrl: 'https://example.test/dav/Beta', username: 'tester', appPassword: 'secret',
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

for (const failure of [null, 'checksum', 'conflict', 'upload']) {
  test(`publishing ${failure ?? 'success'} verifies bytes and never overwrites existing betas`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'beta-publish-test-'));
    try {
      const apk = join(directory, 'test.apk');
      await writeFile(apk, 'signed apk fixture');
      const calls = [];
      let uploaded;
      const request = async (url, options) => {
        calls.push({ url, ...options });
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('tester:secret').toString('base64'));
        if (options.method === 'PUT') {
          const chunks = [];
          for await (const chunk of options.body) chunks.push(chunk);
          uploaded = Buffer.concat(chunks);
          assert.equal(options.headers['If-None-Match'], '*');
          return new Response(null, { status: failure === 'upload' ? 503 : 201 });
        }
        if (options.method === 'GET') return new Response(failure === 'checksum' ? 'broken' : uploaded);
        if (options.method === 'MOVE') {
          assert.equal(options.headers.Overwrite, 'F');
          assert.equal(options.headers.Destination, config.folderUrl + 'webdav-auto-upload-2.apk');
          return new Response(null, { status: failure === 'conflict' ? 412 : 201 });
        }
        assert.equal(options.method, 'DELETE');
        return new Response(null, { status: 204 });
      };
      if (failure) {
        await assert.rejects(publishBeta(config, apk, 2, request));
        assert.equal(calls.at(-1).method, 'DELETE');
        assert.equal(calls.at(-1).url, calls[0].url);
        if (failure !== 'conflict') assert.ok(!calls.some(call => call.method === 'MOVE'));
      } else {
        const result = await publishBeta(config, apk, 2, request);
        assert.equal(result.fileName, 'webdav-auto-upload-2.apk');
        assert.deepEqual(calls.map(call => call.method), ['PUT', 'GET', 'MOVE']);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
