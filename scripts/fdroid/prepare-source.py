#!/usr/bin/env python3
"""Remove unused prebuilts and npm-local repositories from the Android build tree."""
import json
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[2]
remove_debug_key = root / 'android/app/debug.keystore'
if remove_debug_key.exists():
    remove_debug_key.unlink()
store = root / 'node_modules/.pnpm'
if not store.is_dir():
    raise SystemExit('Install the locked pnpm dependencies first.')


def remove(path):
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


manifests = [*store.glob('*/node_modules/*/package.json'), *store.glob('*/node_modules/@*/*/package.json')]
local_urls = (
    '"$rootDir/../node_modules/react-native/android"',
    '"$rootDir/../node_modules/jsc-android/dist"',
    '"${reactNativeRootDir}/android"',
    '"${project.ext.resolveModulePath("react-native")}/android"',
    'mavenLocal().url',
)
for manifest in manifests:
    package = manifest.parent
    if package.is_symlink():
        continue
    name = json.loads(manifest.read_text())['name']
    # These Expo archives are unused: Android modules compile from source; no Apple build runs.
    if name.startswith(('expo', '@expo/')):
        remove(package / 'local-maven-repo')
        remove(package / 'prebuilds/output')
    if name == '@expo/expo-modules-macros-plugin':
        remove(package / 'apple/ExpoModulesMacros-tool')
    if name == 'expo':
        # Used only for initial native-project generation, which has already completed.
        remove(package / 'template.tgz')
    if name == 'react-native':
        remove(package / 'React/I18n/strings')  # Apple translation data, unused on Android.
        remove(package / 'ReactAndroid/publish.gradle')  # Upstream publishing, not app compilation.
    if name == 'hermes-compiler':
        remove(package / 'hermesc/win64-bin')
        remove(package / 'hermesc/osx-bin')
    if name == 'fb-dotslash':
        remove(package / 'bin')  # Android uses the pinned hermes-compiler directly.
    if name in {
        'react-native-screens', 'react-native-safe-area-context',
        '@react-native-async-storage/async-storage', '@react-native-masked-view/masked-view',
        'expo-dev-launcher', 'expo-dev-menu', 'expo-modules-core',
    }:
        for gradle in (package / 'android').glob('*.gradle'):
            original = gradle.read_text()
            text = original
            for url in local_urls:
                block = r'maven\s*\{\s*(?://[^\n]*\n\s*)*url\s*=?\s*' + re.escape(url) + r'\s*\}'
                text = re.sub(block, '', text)
            text = re.sub(r'^\s*mavenLocal\(\)\s*$', '', text, flags=re.MULTILINE)
            if text != original:
                # Replace the file rather than modifying a hard link into pnpm's shared store.
                gradle.unlink()
                gradle.write_text(text)
print('Prepared Android source: unused prebuilts and legacy local repositories removed.')
