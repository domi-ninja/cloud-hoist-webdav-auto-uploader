#!/usr/bin/env sh

set -eu

. "$(dirname "$0")/android-env.sh"

EMULATOR_SERIAL=$(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')
if [ -z "$EMULATOR_SERIAL" ]; then
  printf '%s\n' "No running Android emulator was found." >&2
  exit 1
fi

RESULT=$(adb -s "$EMULATOR_SERIAL" shell content call \
  --uri content://ninja.domi.webdavautoupload.account-acceptance \
  --method seed)

case "$RESULT" in
  *status=ok*) ;;
  *)
    printf '%s\n' "$RESULT" >&2
    exit 1
    ;;
esac

adb -s "$EMULATOR_SERIAL" shell am force-stop ninja.domi.webdavautoupload
adb -s "$EMULATOR_SERIAL" shell monkey \
  -p ninja.domi.webdavautoupload \
  -c android.intent.category.LAUNCHER 1 >/dev/null
