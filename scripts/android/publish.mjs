// Upload credentials are local only. Never follow redirects carrying authorization.
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';

export function validatePublishConfig(config) {
  const url = new URL(config.folderUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Publishing requires an HTTPS WebDAV folder URL without credentials, query or fragment.');
  }
  if (typeof config.username !== 'string' || !config.username || config.username.includes(':') ||
      typeof config.appPassword !== 'string' || !config.appPassword) {
    throw new Error('Publishing requires username and appPassword.');
  }
  url.pathname = url.pathname.replace(/\/$/, '') + '/';
  return { ...config, folderUrl: url.href };
}

export async function loadPublishConfig() {
  try {
    return validatePublishConfig(JSON.parse(await readFile('.signing/publish.json', 'utf8')));
  } catch {
    throw new Error('Missing or invalid .signing/publish.json. See README.md: Publish a beta.');
  }
}

function client(config, request) {
  const authorization = 'Basic ' + Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  return async (url, method, headers = {}, body) => {
    let response;
    try {
      response = await request(url, {
        method, redirect: 'error', signal: AbortSignal.timeout(10 * 60_000),
        headers: { ...headers, Authorization: authorization },
        ...(body ? { body, duplex: 'half' } : {}),
      });
    } catch {
      throw new Error(`WebDAV ${method} failed. Check connectivity and the publishing configuration.`);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`WebDAV ${method} failed: HTTP ${response.status}.`);
    }
    return response;
  };
}

export async function checkPublishDestination(config, request = fetch) {
  const response = await client(config, request)(config.folderUrl, 'PROPFIND', { Depth: '0' });
  await response.body?.cancel();
  if (response.status !== 207) throw new Error('The publishing URL is not a WebDAV collection.');
}

async function sha256(stream) {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

export async function publishBeta(config, apk, versionCode, request = fetch) {
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('Invalid Android version code.');
  const send = client(config, request);
  const fileName = `webdav-auto-upload-${versionCode}.apk`;
  const target = new URL(fileName, config.folderUrl).href;
  const staging = new URL(`.beta-${randomUUID()}.part`, config.folderUrl).href;
  const expected = await sha256(createReadStream(apk));
  try {
    const uploaded = await send(staging, 'PUT', {
      'Content-Type': 'application/vnd.android.package-archive', 'If-None-Match': '*',
    }, createReadStream(apk));
    await uploaded.body?.cancel();
    const downloaded = await send(staging, 'GET');
    if (!downloaded.body || await sha256(downloaded.body) !== expected) {
      throw new Error('Uploaded APK checksum mismatch; beta was not published.');
    }
    const moved = await send(staging, 'MOVE', { Destination: target, Overwrite: 'F' });
    await moved.body?.cancel();
    console.log(`Published ${fileName}\nSHA-256: ${expected}`);
    return { fileName, sha256: expected };
  } catch (error) {
    // Only our uniquely named staging upload is eligible for cleanup, never existing betas.
    try {
      const removed = await send(staging, 'DELETE');
      await removed.body?.cancel();
    } catch {
      console.error('Staging cleanup could not be confirmed. Check the beta folder for .beta-*.part files.');
    }
    throw error;
  }
}
