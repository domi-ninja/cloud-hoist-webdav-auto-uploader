import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256, validateAttribution, validateNativeLibraries } from './attribution.mjs';

const fixture = () => ({
  components: [{ name: 'Codec', version: '1', license: 'MIT', source: 'https://example.org/v1/LICENSE', requires: ['parent@1'], notices: [{ path: 'LICENSE', text: 'Copyright and permission', sha256: sha256('Copyright and permission') }] }],
  nativeLibraries: { 'libcodec.so': ['Codec@1'] },
});

test('a parent dependency update requires another attribution review', () => {
  assert.doesNotThrow(() => validateAttribution(fixture(), new Set(['parent@1'])));
  assert.throws(() => validateAttribution(fixture(), new Set(['parent@2'])), /parent changed/);
});

test('missing and altered notices cannot pass the attribution gate', () => {
  const missing = fixture();
  missing.components[0].notices = [];
  assert.throws(() => validateAttribution(missing, new Set(['parent@1'])), /Missing attribution/);
  const altered = fixture();
  altered.components[0].notices[0].text = 'Truncated notice';
  assert.throws(() => validateAttribution(altered, new Set(['parent@1'])), /evidence changed/);
  const unknown = fixture();
  unknown.nativeLibraries['libcodec.so'] = ['Missing component'];
  assert.throws(() => validateAttribution(unknown, new Set(['parent@1'])), /Unknown attribution owner/);
});

test('every APK ABI must account for its shipped native libraries', () => {
  const evidence = fixture();
  assert.deepEqual(validateNativeLibraries(evidence, ['classes.dex', 'lib/arm64-v8a/libcodec.so', 'lib/x86/libcodec.so']), ['arm64-v8a', 'x86']);
  assert.throws(() => validateNativeLibraries(evidence, ['lib/arm64-v8a/libcodec.so', 'lib/x86/libunknown.so']), /needs attribution/);
  evidence.nativeLibraries['libother.so'] = ['parent@1'];
  assert.throws(() => validateNativeLibraries(evidence, ['lib/arm64-v8a/libcodec.so']), /is missing/);
  assert.throws(() => validateNativeLibraries(fixture(), ['classes.dex']), /No native libraries/);
});
