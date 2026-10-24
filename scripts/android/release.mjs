// Local validation signing only. F-Droid builds never need these private credentials.
import { randomBytes, X509Certificate } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { validateReleaseIdentity } from './release-identity.mjs';

process.umask(0o077);
const signingDir = resolve('.signing');
const credentialsPath = join(signingDir, 'release.json');
const app = JSON.parse(await readFile('app.json', 'utf8')).expo;
const tooling = JSON.parse(await readFile('package.json', 'utf8'));
const identity = validateReleaseIdentity(app, tooling.version);

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'identity') { console.log(JSON.stringify(identity)); return; }
  const keytool = join(process.env.JAVA_HOME, 'bin/keytool');
  if (mode === 'init') {
    await mkdir(signingDir, { mode: 0o700 });
    const password = randomBytes(32).toString('hex');
    const credentials = { storeFile: 'release.p12', storePassword: password, keyAlias: 'upload', keyPassword: password };
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    run(keytool, ['-genkeypair', '-keystore', join(signingDir, credentials.storeFile), '-storetype', 'PKCS12',
      '-storepass:env', 'LOCAL_SIGNING_PASSWORD', '-keypass:env', 'LOCAL_SIGNING_PASSWORD', '-alias', credentials.keyAlias,
      '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', 'CN=Cloud Hoist'],
    { ...process.env, LOCAL_SIGNING_PASSWORD: password });
    await chmod(join(signingDir, credentials.storeFile), 0o600);
    console.log('Signing identity created. Back up both .signing files securely.');
    return;
  }
  if (!['sign', 'verify'].includes(mode)) throw new Error('Expected identity, init, sign, or verify.');
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  const signingEnv = { ...process.env, LOCAL_SIGNING_PASSWORD: credentials.storePassword, LOCAL_KEY_PASSWORD: credentials.keyPassword };
  const apksigner = join(process.env.ANDROID_HOME, 'build-tools/36.0.0/apksigner');
  const apk = mode === 'verify' && process.argv[3] ? resolve(process.argv[3]) : resolve(identity.apk);
  if (mode === 'sign') {
    run(apksigner, ['sign', '--ks', join(signingDir, credentials.storeFile), '--ks-key-alias', credentials.keyAlias,
      '--ks-pass', 'env:LOCAL_SIGNING_PASSWORD', '--key-pass', 'env:LOCAL_KEY_PASSWORD', '--out', apk, resolve(identity.unsignedApk)], signingEnv);
  }
  const verification = run(apksigner, ['verify', '--verbose', '--print-certs', apk]);
  const certificate = spawnSync(keytool, ['-exportcert', '-keystore', join(signingDir, credentials.storeFile),
    '-alias', credentials.keyAlias, '-storepass:env', 'LOCAL_SIGNING_PASSWORD'], { env: signingEnv });
  if (certificate.status !== 0) throw new Error('Could not read the release signing certificate.');
  const expected = new X509Certificate(certificate.stdout).fingerprint256.replaceAll(':', '').toLowerCase();
  if (verification.match(/^Signer #1 certificate SHA-256 digest: ([a-f0-9]+)$/m)?.[1] !== expected) {
    throw new Error('APK was not signed with the existing release key.');
  }
  const badging = run(join(process.env.ANDROID_HOME, 'build-tools/36.0.0/aapt'), ['dump', 'badging', apk]);
  if (!badging.includes(`name='${app.android.package}' versionCode='${identity.versionCode}' versionName='${identity.version}'`)) {
    throw new Error('APK identity does not match app.json.');
  }
  console.log(`Verified ${identity.version}, existing release certificate SHA-256: ${expected}`);
  if (mode === 'sign') console.log(`Signed local validation APK: ${identity.apk}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
