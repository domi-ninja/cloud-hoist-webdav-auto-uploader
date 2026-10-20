#!/usr/bin/env sh

# Seeds the debug account through the app's debug-only content provider, then relaunches the app.
# Run with `pnpm android:seed-account phone|emu`; ANDROID_SERIAL selects an exact target.
# The selected target must already have the debug build and acceptance provider installed.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/env.sh"

TARGET_SERIAL=$("$SCRIPT_DIR/resolve-device.sh" "$@")

RESULT=$(adb -s "$TARGET_SERIAL" shell content call \
  --uri content://ninja.domi.cloudhoist.account-acceptance \
  --method seed)

case "$RESULT" in
  *status=ok*) ;;
  *)
    printf '%s\n' "$RESULT" >&2
    exit 1
    ;;
esac

adb -s "$TARGET_SERIAL" shell am force-stop ninja.domi.cloudhoist
adb -s "$TARGET_SERIAL" shell monkey \
  -p ninja.domi.cloudhoist \
  -c android.intent.category.LAUNCHER 1 >/dev/null
