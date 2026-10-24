#!/usr/bin/env sh
# Compile the already prepared tree. F-Droid replaces the untrusted Gradle wrapper.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/../.."
. "$SCRIPT_DIR/../android/env.sh"
export CI=1 NODE_ENV=production EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 TZ=UTC
"${GRADLE:-./android/gradlew}" -p android -I ../scripts/fdroid/unsigned.gradle -I ../scripts/fdroid/dependencies.gradle \
  -Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=2048m" --max-workers=4 :app:fdroidDependencyInventory :app:assembleRelease
mkdir -p dist
APP_VERSION=$(node -p 'JSON.parse(require("node:fs").readFileSync("app.json", "utf8")).expo.version')
cp android/app/build/outputs/apk/release/app-release-unsigned.apk "dist/cloud-hoist-$APP_VERSION-unsigned.apk"
printf 'Unsigned F-Droid candidate: dist/cloud-hoist-%s-unsigned.apk\n' "$APP_VERSION"
