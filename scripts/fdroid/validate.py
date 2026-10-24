#!/usr/bin/env python3
"""Run F-Droid's source/build/APK gates on a clean local Git checkout, without publishing."""
import argparse
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from fdroidserver._yaml import yaml

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--gradle', required=True, help='Trusted Gradle 9.3.1 executable or gradlew-fdroid')
args = parser.parse_args()
gradle = shutil.which(args.gradle)
if not gradle:
    raise SystemExit('The trusted Gradle executable is missing.')
if subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).strip():
    raise SystemExit('Commit the candidate first; this check builds committed source only.')
app = json.loads((root / 'app.json').read_text())['expo']
package = app['android']['package']
recipe = yaml.load(root / f'metadata/{package}.yml')
build = recipe['Builds'][-1]
if (build['versionName'], build['versionCode']) != (app['version'], app['android']['versionCode']):
    raise SystemExit('Update the F-Droid candidate recipe to match app.json.')
java = os.environ['JAVA_HOME']
sdk = os.environ['ANDROID_HOME']
recipe['Repo'] = str(root)
build['commit'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
build.pop('disable', None)  # Enable only this local test copy; never uses --force or skips scans.
build['prebuild'] = [line.replace('/usr/lib/jvm/java-21-openjdk-amd64', shlex.quote(java)) for line in build['prebuild']]
build['build'] = [
    f'export JAVA_HOME={shlex.quote(java)} ANDROID_HOME={shlex.quote(sdk)}',
    f'GRADLE={shlex.quote(gradle)} sh scripts/fdroid/assemble.sh',
]
(root / 'test-results').mkdir(exist_ok=True)
work = Path(tempfile.mkdtemp(prefix='fdroid-validation-', dir=root / 'test-results'))
(work / 'metadata').mkdir()
with (work / f'metadata/{package}.yml').open('w') as handle:
    yaml.dump(recipe, handle)
with (work / 'config.yml').open('w') as handle:
    yaml.dump({'sdk_path': sdk, 'ndk_paths': {str(build['ndk']): str(Path(sdk) / 'ndk' / str(build['ndk']))}, 'java_paths': {'21': java}}, handle)
# fdroidserver 2.4.5 reads SOURCE_DATE_EPOCH before doing its own checkout.
checkout = work / 'build' / package
checkout.parent.mkdir()
subprocess.run(['git', 'clone', '--quiet', '--no-hardlinks', str(root), str(checkout)], check=True)
environment = {**os.environ, 'PATH': str(Path(sys.executable).parent) + os.pathsep + os.environ['PATH']}
print(f'F-Droid validation directory: {work}', flush=True)
subprocess.run([sys.executable, '-m', 'fdroidserver', 'build', '--test', '--stop', '--scan-binary', '--no-tarball', f"{package}:{build['versionCode']}"], cwd=work, env=environment, check=True)
output = root / 'dist' / f"cloud-hoist-{app['version']}-unsigned.apk"
output.parent.mkdir(exist_ok=True)
shutil.copy2(work / 'tmp' / f"{package}_{build['versionCode']}.apk", output)
print(f'Verified unsigned candidate: {output}')
print(f'SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}')
