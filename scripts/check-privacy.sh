#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")

. "$SCRIPT_DIR/android-env.sh"

cd "$PROJECT_ROOT"

DEPENDENCY_FILES="package.json pnpm-lock.yaml android/build.gradle android/app/build.gradle modules/webdav-upload-engine/android/build.gradle"
FORBIDDEN_DEPENDENCIES='firebase-analytics|firebase-crashlytics|sentry-android|@sentry/react-native|appsflyer|adjust-android|play-services-ads|play-services-analytics|facebook-android-sdk'
if grep -Eiq "$FORBIDDEN_DEPENDENCIES" $DEPENDENCY_FILES; then
  printf '%s\n' "A prohibited telemetry or advertising dependency is present." >&2
  grep -Ein "$FORBIDDEN_DEPENDENCIES" $DEPENDENCY_FILES >&2
  exit 1
fi

pnpm exec expo prebuild --platform android --no-install >/dev/null
NODE_ENV=production ./android/gradlew -p android :app:assembleRelease >/dev/null

AAPT="$ANDROID_PROJECT_SDK/build-tools/36.0.0/aapt"
APK=android/app/build/outputs/apk/release/app-release.apk
PERMISSIONS=$($AAPT dump permissions "$APK")

for prohibited in android.permission.SYSTEM_ALERT_WINDOW com.google.android.gms.permission.AD_ID; do
  if printf '%s\n' "$PERMISSIONS" | grep -Fq "$prohibited"; then
    printf '%s\n' "Release APK requests prohibited permission $prohibited." >&2
    exit 1
  fi
done

for required in android.permission.INTERNET android.permission.POST_NOTIFICATIONS android.permission.FOREGROUND_SERVICE_DATA_SYNC; do
  if ! printf '%s\n' "$PERMISSIONS" | grep -Fq "$required"; then
    printf '%s\n' "Release APK is missing required permission $required." >&2
    exit 1
  fi
done

printf '%s\n' "Release dependencies and permissions contain no known telemetry or advertising hooks."
