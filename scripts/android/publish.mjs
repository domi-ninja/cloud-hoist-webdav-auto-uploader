// Upload credentials are local only. Never follow redirects carrying authorization.
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

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
  try { loadEnvFile('.env'); } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Could not load .env.');
  }
  try {
    return publishConfigFromEnv(process.env);
  } catch {
    throw new Error('Missing or invalid NEXTCLOUD publishing variables in .env. See README.md: Publish a beta.');
  }
}

export function publishConfigFromEnv(env) {
  const root = new URL(env.NEXTCLOUD_WEBDAV_URL);
  const segments = env.NEXTCLOUD_DIRECTORY?.split('/').filter(Boolean);
  if (!segments?.length || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error('NEXTCLOUD_DIRECTORY must name a dedicated beta folder.');
  }
  root.pathname = root.pathname.replace(/\/$/, '') + '/' + segments.map(encodeURIComponent).join('/') + '/';
  return validatePublishConfig({
    folderUrl: root.href,
    username: env.NEXTCLOUD_USERNAME,
    appPassword: env.NEXTCLOUD_PASSWORD,
  });
}

function client(config, request) {
  const authorization = 'Basic ' + Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  return async (url, method, headers = {}, body, acceptedStatuses = []) => {
    let response;
    for (let attempt = 0; attempt < 4; attempt++) {
      const requestBody = typeof body === 'function' ? body() : body;
      try {
        response = await request(url, {
          method, redirect: 'error', signal: AbortSignal.timeout(10 * 60_000),
          headers: { ...headers, Authorization: authorization },
          ...(requestBody ? { body: requestBody, duplex: 'half' } : {}),
        });
        break;
      } catch (error) {
        requestBody?.destroy?.();
        const code = error.cause?.code;
        // Refused connections never reached WebDAV; recreate upload streams before retrying.
        if (code === 'ECONNREFUSED' && attempt < 3) {
          await delay(1000 * 2 ** attempt);
          continue;
        }
        const detail = typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? ` (${code})` : '';
        throw new Error(`WebDAV ${method} failed${detail}. Check connectivity and the publishing configuration.`);
      }
    }
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      await response.body?.cancel();
      throw new Error(`WebDAV ${method} failed: HTTP ${response.status}.`);
    }
    return response;
  };
}

export async function checkPublishDestination(config, request = fetch) {
  const send = client(config, request);
  const response = await send(config.folderUrl, 'PROPFIND', { Depth: '0' }, undefined, [404]);
  await response.body?.cancel();
  if (response.status === 404) {
    const created = await send(config.folderUrl, 'MKCOL');
    await created.body?.cancel();
    return;
  }
  if (response.status !== 207) throw new Error('The publishing URL is not a WebDAV collection.');
}

async function sha256(stream) {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

export async function publishBeta(config, apk, { version, versionCode }, request = fetch) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) {
    throw new Error('Invalid app version.');
  }
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('Invalid Android version code.');
  const send = client(config, request);
  // Use the artifact timestamp so retrying the same APK keeps its release filename.
  const timestamp = (await stat(apk)).mtime.toISOString().replace(/:/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `cloud-hoist-${version}-${timestamp}-build-${versionCode}.apk`;
  const target = new URL(fileName, config.folderUrl).href;
  // Nextcloud reserves .part paths for its own upload handling.
  const staging = new URL(`.beta-${randomUUID()}.apk`, config.folderUrl).href;
  const expected = await sha256(createReadStream(apk));
  try {
    console.log(`Uploading ${fileName}…`);
    const uploaded = await send(staging, 'PUT', {
      'Content-Type': 'application/vnd.android.package-archive', 'If-None-Match': '*',
    }, () => createReadStream(apk));
    await uploaded.body?.cancel();
    console.log('Downloading the uploaded APK to verify its checksum…');
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
      console.error('Staging cleanup could not be confirmed. Check the beta folder for .beta-*.apk files.');
    }
    throw error;
  }
}
