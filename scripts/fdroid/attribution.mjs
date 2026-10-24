import { createHash } from 'node:crypto';

export const sha256 = text => createHash('sha256').update(text).digest('hex');

/** Reject stale parent versions, altered evidence, and unaccounted native code. */
export function validateAttribution(evidence, knownPackages) {
  const components = new Set(evidence.components.map(entry => `${entry.name}@${entry.version}`));
  if (components.size !== evidence.components.length) throw new Error('Duplicate embedded attribution component.');
  for (const entry of evidence.components) {
    if (!entry.source || !entry.license || !entry.notices.length) throw new Error(`Missing attribution for ${entry.name}.`);
    for (const parent of entry.requires) {
      if (!knownPackages.has(parent)) throw new Error(`Attribution parent changed: ${parent}. Review ${entry.name}.`);
    }
    for (const notice of entry.notices) {
      if (!notice.text.trim() || sha256(notice.text) !== notice.sha256) throw new Error(`Attribution evidence changed: ${entry.name}/${notice.path}.`);
    }
  }
  for (const [library, owners] of Object.entries(evidence.nativeLibraries)) {
    if (!owners.length) throw new Error(`Missing attribution owner for ${library}.`);
    for (const owner of owners) {
      if (!components.has(owner) && !knownPackages.has(owner)) throw new Error(`Unknown attribution owner: ${library}: ${owner}.`);
    }
  }
}

export function validateNativeLibraries(evidence, files) {
  const expected = new Set(Object.keys(evidence.nativeLibraries));
  const perAbi = new Map();
  for (const file of files) {
    const match = /^lib\/([^/]+)\/([^/]+\.so)$/.exec(file);
    if (!match) continue;
    const [, abi, name] = match;
    if (!expected.has(name)) throw new Error(`Native library needs attribution: ${file}.`);
    if (!perAbi.has(abi)) perAbi.set(abi, new Set());
    perAbi.get(abi).add(name);
  }
  if (!perAbi.size) throw new Error('No native libraries found in APK.');
  for (const [abi, libraries] of perAbi) {
    for (const name of expected) {
      if (!libraries.has(name)) throw new Error(`Native attribution inventory changed: ${abi}/${name} is missing.`);
    }
  }
  return [...perAbi.keys()];
}
