import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

export function releaseBuildNumber(runNumber, sourceBuild, publishedBuild = 0) {
  const build = Math.max(1000 + Number(runNumber), sourceBuild + 1, publishedBuild + 1);
  if (!Number.isSafeInteger(Number(runNumber)) || Number(runNumber) < 1 ||
      !Number.isSafeInteger(build) || build > 2100000000) {
    throw new Error('Invalid GitHub release build number.');
  }
  return build;
}

export async function latestPublishedBuild(repository, androidPackage, fetcher = fetch) {
  const response = await fetcher(`https://github.com/${repository}/releases/latest/download/update.json`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error(`Could not read the last published build (${response.status}).`);
  const latest = await response.json();
  if (!Number.isSafeInteger(latest.versionCode) || latest.versionCode < 1 || latest.androidPackage !== androidPackage) {
    throw new Error('Published release metadata does not match this app.');
  }
  return latest.versionCode;
}

export function releaseMetadata(app, repository, sha256) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) ||
      !/^[a-z0-9-]+$/.test(app.slug) ||
      !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(app.version) ||
      !Number.isSafeInteger(app.android.versionCode) || app.android.versionCode < 1 ||
      !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Invalid release identity or checksum.');
  }
  const tag = `android-build-${app.android.versionCode}`;
  const fileName = `${app.slug}-${app.version}-build-${app.android.versionCode}.apk`;
  return {
    tag,
    fileName,
    manifest: {
      schemaVersion: 1,
      appName: app.name,
      androidPackage: app.android.package,
      version: app.version,
      versionCode: app.android.versionCode,
      apkUrl: `https://github.com/${repository}/releases/download/${tag}/${fileName}`,
      sha256,
    },
  };
}

async function main() {
  const app = JSON.parse(await readFile('app.json', 'utf8'));
  const config = JSON.parse(await readFile('release.config.json', 'utf8'));
  if (process.env.GITHUB_REPOSITORY !== config.githubRepository) {
    throw new Error('This release job must run in the configured GitHub repository.');
  }
  if (process.argv[2] === 'prepare') {
    const publishedBuild = await latestPublishedBuild(config.githubRepository, app.expo.android.package);
    app.expo.android.versionCode = releaseBuildNumber(process.env.GITHUB_RUN_NUMBER, app.expo.android.versionCode, publishedBuild);
    await writeFile('app.json', JSON.stringify(app, null, 2) + '\n');
    console.log(`Building ${app.expo.name} ${app.expo.version}, build ${app.expo.android.versionCode}.`);
    return;
  }
  if (process.argv[2] !== 'package') throw new Error('Expected prepare or package.');
  const apk = 'dist/cloud-hoist-beta.apk';
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(apk)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  const release = releaseMetadata(app.expo, config.githubRepository, sha256);
  await mkdir('dist/github', { recursive: true });
  await copyFile(apk, `dist/github/${release.fileName}`);
  await writeFile('dist/github/update.json', JSON.stringify(release.manifest, null, 2) + '\n');
  await writeFile('dist/github/SHA256SUMS', `${sha256}  ${release.fileName}\n`);
  await writeFile('dist/github/release-notes.md',
    `Download **${release.fileName}** and open it on Android to install or update ${app.expo.name}.\n\n` +
    `This is a beta build. Android asks you to approve installation. Updates signed with the same key preserve your settings and history.\n\n` +
    `Cloud Hoist installs separately from the older WebDAV Auto Upload app.\n\nSource commit: ${process.env.GITHUB_SHA}\n`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
    `tag=${release.tag}\nfile_name=${release.fileName}\nversion_code=${app.expo.android.versionCode}\n`);
  console.log(`Packaged ${release.fileName}; SHA-256 ${sha256}.`);
}

if (import.meta.main) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
