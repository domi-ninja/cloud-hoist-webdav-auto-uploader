// Private beta signing. Credentials stay in ignored, owner-only files, never CLI arguments.
import { randomBytes, X509Certificate } from 'node:crypto';
import { mkdir, writeFile, readFile, chmod, copyFile, rmdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { checkPublishDestination, loadPublishConfig, publishBeta } from './publish.mjs';

process.umask(0o077);
const signingDir = resolve('.signing');
const credentialsPath = join(signingDir, 'release.json');
const keystore = join(signingDir, 'release.p12');

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'init') {
    // Exclusive creation refuses to replace an existing or partially created signing identity.
    await mkdir(signingDir, { mode: 0o700 });
    const password = randomBytes(32).toString('hex');
    const credentials = { storeFile: 'release.p12', storePassword: password, keyAlias: 'upload', keyPassword: password };
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    run(join(process.env.JAVA_HOME, 'bin/keytool'), [
      '-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12',
      '-storepass:env', 'BETA_KEY_PASSWORD', '-keypass:env', 'BETA_KEY_PASSWORD',
      '-alias', credentials.keyAlias, '-keyalg', 'RSA', '-keysize', '4096',
      '-validity', '10000', '-dname', 'CN=Cloud Hoist',
    ], { ...process.env, BETA_KEY_PASSWORD: password });
    await chmod(keystore, 0o600);
    console.log('Signing identity created in .signing/. Back up BOTH files securely before distributing builds.');
    return;
  }
  if (!['build', 'verify', 'publish'].includes(mode)) throw new Error('Usage: pnpm android:signing, pnpm android:beta, or pnpm android:publish');
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  const app = JSON.parse(await readFile('app.json', 'utf8'));
  let publishConfig;
  let versionCode;
  if (mode === 'publish') {
    publishConfig = await loadPublishConfig();
    await checkPublishDestination(publishConfig);
    versionCode = app.expo.android.versionCode + 1;
    if (!Number.isSafeInteger(versionCode) || versionCode < 2 || versionCode > 2100000000) {
      throw new Error('app.json must contain a valid Android versionCode with room to increment.');
    }
    app.expo.android.versionCode = versionCode;
    await writeFile('app.json', JSON.stringify(app, null, 2) + '\n');
    console.log(`Building beta ${versionCode}. Keep this version bump even if publishing fails.`);
  }
  if (mode === 'build' || mode === 'publish') {
    const betaEnv = { ...process.env, EXPO_PUBLIC_RELEASE_CHANNEL: 'beta' };
    run('pnpm', ['prebuild'], betaEnv);
    run('./android/gradlew', ['-p', 'android', '-I', '../scripts/android/release.init.gradle', ':app:assembleRelease'], {
      ...betaEnv, NODE_ENV: 'production',
    });
  }
  const apk = resolve('android/app/build/outputs/apk/release/app-release.apk');
  const verification = spawnSync(join(process.env.ANDROID_HOME, 'build-tools/36.0.0/apksigner'),
    ['verify', '--verbose', '--print-certs', apk], { encoding: 'utf8' });
  if (verification.status !== 0) throw new Error('APK signature verification failed');
  const certificate = spawnSync(join(process.env.JAVA_HOME, 'bin/keytool'), [
    '-exportcert', '-keystore', join(signingDir, credentials.storeFile),
    '-alias', credentials.keyAlias, '-storepass:env', 'BETA_KEY_PASSWORD',
  ], { env: { ...process.env, BETA_KEY_PASSWORD: credentials.storePassword } });
  if (certificate.status !== 0) throw new Error('Could not read the release signing certificate');
  const fingerprint = new X509Certificate(certificate.stdout).fingerprint256.replaceAll(':', '').toLowerCase();
  const apkFingerprint = verification.stdout.match(/^Signer #1 certificate SHA-256 digest: ([a-f0-9]+)$/m)?.[1];
  if (apkFingerprint !== fingerprint) throw new Error('APK was not signed with the private release key');
  console.log(`Verified release certificate SHA-256: ${fingerprint}`);
  if (mode === 'verify') return;
  await mkdir('dist', { recursive: true });
  await copyFile(apk, 'dist/cloud-hoist-beta.apk');
  console.log('Signed beta: dist/cloud-hoist-beta.apk. No devices were changed.');
  if (publishConfig) await publishBeta(publishConfig, apk, { version: app.expo.version, versionCode });
}

async function guardedMain() {
  if (!['build', 'publish'].includes(process.argv[2])) return main();
  await mkdir('dist', { recursive: true });
  const lock = 'dist/.beta-build-lock';
  try { await mkdir(lock); } catch {
    throw new Error('Another beta build is running, or dist/.beta-build-lock remains from an interrupted build.');
  }
  try { await main(); } finally { await rmdir(lock); }
}

guardedMain().catch((error) => { console.error(error.message); process.exitCode = 1; });
