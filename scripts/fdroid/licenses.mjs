// Build an offline notice inventory from installed packages and reviewed upstream evidence.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const check = process.argv.includes('--check');
const inventory = JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
const upstream = JSON.parse(await readFile('licenses/npm-upstream.json', 'utf8'));
const native = JSON.parse(await readFile('licenses/native.json', 'utf8'));
const declarations = JSON.parse(await readFile('licenses/declarations.json', 'utf8'));
const texts = {};
const packages = [];
const addText = text => {
  const normalized = text.replaceAll('\r\n', '\n').trim();
  const key = createHash('sha256').update(normalized).digest('hex');
  texts[key] = normalized;
  return key;
};
const apache = addText(await readFile('licenses/Apache-2.0.txt', 'utf8'));
const mit = addText(await readFile('licenses/MIT.txt', 'utf8'));

for (const entries of Object.values(inventory)) {
  for (const entry of entries) {
    for (const root of entry.paths) {
      const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
      const key = `${manifest.name}@${manifest.version}`;
      const licenseTexts = [];
      const filenames = (await readdir(root)).filter(name => /^(license|licence|notice|copying|copyright)/i.test(name)).sort();
      for (const filename of filenames) {
        const content = await readFile(join(root, filename), 'utf8').catch(() => null);
        if (content) licenseTexts.push(addText(content));
      }
      if (!licenseTexts.length && upstream[key]?.text) licenseTexts.push(addText(upstream[key].text));
      if (!licenseTexts.length) {
        const reviewed = declarations[key];
        if (!reviewed || reviewed.license !== manifest.license) throw new Error(`Review missing license evidence for ${key}.`);
        licenseTexts.push(addText(reviewed.text));
        if (/\bMIT\b/.test(manifest.license)) licenseTexts.push(mit);
        if (/Apache-2\.0/.test(manifest.license)) licenseTexts.push(apache);
      }
      packages.push({ name: manifest.name, version: manifest.version, license: entry.license, source: `https://www.npmjs.com/package/${manifest.name}/v/${manifest.version}`, textIds: [...new Set(licenseTexts)] });
    }
  }
}
for (const [coordinate, entry] of Object.entries(native)) {
  if (entry.error) throw new Error(`Native license evidence missing for ${coordinate}: ${entry.error}`);
  const ids = entry.notices.map(notice => addText(notice.text));
  const licenses = entry.licenseDeclarations.length ? entry.licenseDeclarations : declarations[coordinate]?.licenseDeclarations;
  if (!licenses?.length) throw new Error(`Review missing native license declaration for ${coordinate}.`);
  if (licenses.some(license => /apache/i.test(license.name))) ids.push(apache);
  if (licenses.some(license => /\bMIT\b/i.test(license.name))) ids.push(mit);
  if (coordinate === 'com.parse.bolts:bolts-tasks:1.4.0') ids.push(addText(await readFile('licenses/Bolts.txt', 'utf8')));
  if (declarations[coordinate]?.text) ids.push(addText(declarations[coordinate].text));
  const [group, name, version] = coordinate.split(':');
  packages.push({ name: `${group}:${name}`, version, license: licenses.map(l => l.name).join('; '), source: entry.source, textIds: [...new Set(ids)] });
}
for (const filename of ['MaterialDesignIcons.txt', 'MaterialSymbols.txt']) {
  const text = await readFile(`licenses/${filename}`, 'utf8');
  packages.push({ name: filename.replace('.txt', ''), version: 'bundled font', license: 'Apache-2.0', source: filename === 'MaterialSymbols.txt' ? 'https://github.com/google/material-design-icons' : 'https://github.com/Templarian/MaterialDesign', textIds: [addText(text), apache] });
}
const app = JSON.parse(await readFile('app.json', 'utf8')).expo;
const ownNotice = { name: app.name, version: app.version, license: 'GPL-3.0-or-later', source: 'https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader', textIds: [addText(await readFile('LICENSE', 'utf8'))] };
const uniquePackages = [...new Map(packages.map(entry => [`${entry.name}@${entry.version}`, entry])).values()];
uniquePackages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'));
const json = JSON.stringify({ packages: [ownNotice, ...uniquePackages], texts }, null, 2) + '\n';
const output = 'assets/third-party-notices.json';
if (check) {
  if (await readFile(output, 'utf8') !== json) throw new Error('License inventory is stale. Run pnpm licenses:generate.');
} else {
  await writeFile(output, json);
}
console.log(`${check ? 'Verified' : 'Wrote'} ${uniquePackages.length + 1} app/package/font entries and ${Object.keys(texts).length} notice texts.`);
