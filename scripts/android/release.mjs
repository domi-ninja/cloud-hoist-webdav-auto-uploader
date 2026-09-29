// Private beta signing. Credentials stay in ignored, owner-only files, never CLI arguments.
import { randomBytes, X509Certificate } from 'node:crypto';
import { mkdir, writeFile, readFile, chmod, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

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
      '-validity', '10000', '-dname', 'CN=WebDAV Auto Upload',
    ], { ...process.env, BETA_KEY_PASSWORD: password });
    await chmod(keystore, 0o600);
    console.log('Signing identity created in .signing/. Back up BOTH files securely before distributing builds.');
    return;
  }
  if (mode !== 'build' && mode !== 'verify') throw new Error('Usage: pnpm android:signing OR pnpm android:beta');
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  if (mode === 'build') {
    run('pnpm', ['prebuild']);
    run('./android/gradlew', ['-p', 'android', '-I', '../scripts/android/release.init.gradle', ':app:assembleRelease'], {
      ...process.env, NODE_ENV: 'production',
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
  await copyFile(apk, 'dist/webdav-auto-upload-beta.apk');
  console.log('Signed beta: dist/webdav-auto-upload-beta.apk. No devices were changed.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
