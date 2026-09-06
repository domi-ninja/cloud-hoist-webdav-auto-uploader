#!/usr/bin/env sh

# Downloads random JPEGs from Lorem Picsum, adds them to the Android emulator's
# Camera and Screenshots collections, and waits for MediaStore to index them.
# Run with `pnpm android:seed-photos`; set PHOTO_COUNT to change the default of 8.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/env.sh"

TARGET_KIND=${1:-emu}
if [ "$TARGET_KIND" != emu ]; then
  printf '%s\n' "This script only seeds emulators. Run it without arguments or with 'emu'." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  printf '%s\n' "curl is required to download sample photos." >&2
  exit 1
fi

SEED_PHOTO_COUNT=${PHOTO_COUNT:-8}
case "$SEED_PHOTO_COUNT" in
  ''|*[!0-9]*)
    printf '%s\n' "PHOTO_COUNT must be a number from 1 to 50." >&2
    exit 1
    ;;
esac
if [ "$SEED_PHOTO_COUNT" -lt 1 ] || [ "$SEED_PHOTO_COUNT" -gt 50 ]; then
  printf '%s\n' "PHOTO_COUNT must be a number from 1 to 50." >&2
  exit 1
fi

TARGET_SERIAL=$("$SCRIPT_DIR/resolve-device.sh" emu)
SEED_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
SEED_TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/webdav-seed-photos.XXXXXX")
trap 'rm -rf "$SEED_TEMP_DIR"' EXIT HUP INT TERM

INDEX=1
while [ "$INDEX" -le "$SEED_PHOTO_COUNT" ]; do
  LOCAL_FILE="$SEED_TEMP_DIR/photo-$INDEX.jpg"
  PHOTO_URL="https://picsum.photos/seed/webdav-$SEED_RUN_ID-$INDEX/1080/1440.jpg"
  curl --connect-timeout 15 --max-time 60 --retry 3 -fsSL "$PHOTO_URL" -o "$LOCAL_FILE" &
  INDEX=$((INDEX + 1))
done
wait

INDEX=1
while [ "$INDEX" -le "$SEED_PHOTO_COUNT" ]; do
  LOCAL_FILE="$SEED_TEMP_DIR/photo-$INDEX.jpg"
  JPEG_HEADER=$(od -An -tx1 -N3 "$LOCAL_FILE" | tr -d ' \n')
  if [ "$JPEG_HEADER" != ffd8ff ]; then
    printf '%s\n' "Downloaded file $INDEX is not a JPEG." >&2
    exit 1
  fi
  INDEX=$((INDEX + 1))
done

adb -s "$TARGET_SERIAL" shell mkdir -p /sdcard/DCIM/Camera /sdcard/Pictures/Screenshots

INDEX=1
while [ "$INDEX" -le "$SEED_PHOTO_COUNT" ]; do
  LOCAL_FILE="$SEED_TEMP_DIR/photo-$INDEX.jpg"
  PADDED_INDEX=$(printf '%03d' "$INDEX")
  if [ $((INDEX % 2)) -eq 0 ]; then
    REMOTE_FILE="/sdcard/Pictures/Screenshots/Screenshot_seed_${SEED_RUN_ID}_${PADDED_INDEX}.jpg"
  else
    REMOTE_FILE="/sdcard/DCIM/Camera/IMG_seed_${SEED_RUN_ID}_${PADDED_INDEX}.jpg"
  fi

  adb -s "$TARGET_SERIAL" push "$LOCAL_FILE" "$REMOTE_FILE" >/dev/null
  adb -s "$TARGET_SERIAL" shell am broadcast \
    -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file://$REMOTE_FILE" >/dev/null
  INDEX=$((INDEX + 1))
done

INDEXED_COUNT=0
ATTEMPT=1
while [ "$ATTEMPT" -le 10 ]; do
  INDEXED_COUNT=$(adb -s "$TARGET_SERIAL" shell content query \
    --uri content://media/external/images/media \
    --projection _display_name 2>/dev/null | grep -c "$SEED_RUN_ID" || true)
  if [ "$INDEXED_COUNT" -eq "$SEED_PHOTO_COUNT" ]; then
    break
  fi
  sleep 1
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$INDEXED_COUNT" -ne "$SEED_PHOTO_COUNT" ]; then
  printf '%s\n' "Added $SEED_PHOTO_COUNT photos, but MediaStore indexed $INDEXED_COUNT before the timeout." >&2
  exit 1
fi

printf '%s\n' "Added $INDEXED_COUNT random photos to $TARGET_SERIAL."
printf '%s\n' "Camera received $(((SEED_PHOTO_COUNT + 1) / 2)); Screenshots received $((SEED_PHOTO_COUNT / 2))."
