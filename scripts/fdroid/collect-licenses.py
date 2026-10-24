#!/usr/bin/env python3
"""Collect pinned upstream license evidence. Requires the resolved Gradle inventory."""
import concurrent.futures
import hashlib
import io
import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'CloudHoist-license-inventory/1'})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def npm_missing(item):
    name, version = item
    metadata = json.loads(download(f'https://registry.npmjs.org/{urllib.parse.quote(name, safe="")}/{version}'))
    repository = metadata.get('repository', {})
    url = repository.get('url', '') if isinstance(repository, dict) else repository
    match = re.search(r'github.com[:/]([^/]+/[^/#]+?)(?:\.git)?$', url) or re.fullmatch(r'([\w.-]+/[\w.-]+)', url)
    commit = metadata.get('gitHead')
    if not match or not commit:
        return f'{name}@{version}', {'error': 'Registry metadata has no pinned GitHub source', 'repository': url}
    repository_name = match[1]
    for filename in ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'license.txt', 'LICENCE', 'UNLICENSE', 'LICENSE-MIT', 'LICENSE-APACHE']:
        source = f'https://raw.githubusercontent.com/{repository_name}/{commit}/{filename}'
        text = download(source)
        if text:
            return f'{name}@{version}', {'source': source, 'text': text.decode('utf8', errors='replace')}
    return f'{name}@{version}', {'error': 'No root license found at the published git commit', 'repository': url, 'commit': commit}


def artifact_notices(artifact):
    """Retain notices in an artifact and in the JARs carried by an Android AAR."""
    notices = []

    def collect(archive, prefix=''):
        for filename in archive.namelist():
            if re.search(r'(?:^|/)(?:LICENSE|LICENCE|NOTICE|COPYING|COPYRIGHT)(?:[._-][^/]*)?$', filename, re.I) and not filename.endswith('/'):
                data = archive.read(filename)
                try:
                    text = data.decode('utf8')
                except UnicodeDecodeError:
                    text = data.decode('latin1')
                notices.append({'path': prefix + filename, 'text': text})
            elif filename == 'classes.jar' or (filename.startswith('libs/') and filename.endswith('.jar')):
                with zipfile.ZipFile(io.BytesIO(archive.read(filename))) as nested:
                    collect(nested, prefix + filename + '!/')

    with zipfile.ZipFile(artifact) as archive:
        collect(archive)
    return notices


def native(item):
    group, name, version = item['group'], item['name'], item['version']
    coordinate = f'{group}:{name}:{version}'
    path = f'{group.replace(".", "/")}/{name}/{version}/{name}-{version}.pom'
    bases = ['https://dl.google.com/dl/android/maven2/', 'https://repo.maven.apache.org/maven2/'] if group.startswith(('androidx.', 'com.android.')) else ['https://repo.maven.apache.org/maven2/', 'https://dl.google.com/dl/android/maven2/']
    for base in bases:
        body = download(base + path)
        if body:
            break
    else:
        raise RuntimeError(f'Missing published POM: {coordinate}')
    pom = ET.fromstring(body)
    ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
    declarations = []
    for element in pom.findall('./m:licenses/m:license', ns):
        declarations.append({'name': element.findtext('m:name', '', ns), 'url': element.findtext('m:url', '', ns)})
    artifact = Path(item['file']) if item['file'] else None
    notices = artifact_notices(artifact) if artifact else []
    return coordinate, {'source': base + path, 'licenseDeclarations': declarations, 'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest() if artifact else None, 'notices': notices}


def main():
    inventory = json.loads(subprocess.check_output(['pnpm', 'licenses', 'list', '--prod', '--json'], cwd=ROOT))
    missing = []
    for packages in inventory.values():
        for package in packages:
            for root in package['paths']:
                if not any(p.is_file() and p.name.lower().startswith(('license', 'licence', 'notice', 'copying', 'copyright')) for p in Path(root).iterdir()):
                    manifest = json.loads((Path(root) / 'package.json').read_text())
                    missing.append((manifest['name'], manifest['version']))
    target = ROOT / 'licenses'
    target.mkdir(exist_ok=True)
    existing_path = target / 'npm-upstream.json'
    supplements = json.loads(existing_path.read_text()) if existing_path.exists() else {}
    needed = [item for item in sorted(set(missing)) if not supplements.get(f'{item[0]}@{item[1]}', {}).get('text')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        supplements.update(dict(pool.map(npm_missing, needed)))
    (target / 'npm-upstream.json').write_text(json.dumps(dict(sorted(supplements.items())), indent=2, ensure_ascii=False) + '\n')
    print(f'Fetched license evidence for {len(supplements)} npm entries.', flush=True)
    for name, evidence in supplements.items():
        if 'error' in evidence:
            print(f'UNRESOLVED {name}: {evidence["error"]}', flush=True)
    artifacts = json.loads((ROOT / 'dist/fdroid-native-dependencies.json').read_text())
    def safe_native(item):
        try:
            return native(item)
        except Exception as error:
            return f'{item["group"]}:{item["name"]}:{item["version"]}', {'error': str(error)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        native_licenses = dict(pool.map(safe_native, artifacts))
    (target / 'native.json').write_text(json.dumps(dict(sorted(native_licenses.items())), indent=2, ensure_ascii=False) + '\n')
    print(f'Fetched POMs and notices for {len(native_licenses)} native components.', flush=True)
    for name, evidence in native_licenses.items():
        if not evidence.get('licenseDeclarations'):
            print(f'UNRESOLVED native license declaration: {name}', flush=True)


if __name__ == '__main__':
    main()
