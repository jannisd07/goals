#!/usr/bin/env bash
# Goals iOS Simulator driver. Run from the repo root:
#   .claude/skills/run-goals/sim.sh <command> [args]
# Every command targets the booted simulator unless GOALS_SIM_DEVICE is set.
set -uo pipefail

BUNDLE_ID="com.vibetime.app"
DEVICE="${GOALS_SIM_DEVICE:-booted}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SHOTS="${GOALS_SHOTS_DIR:-/tmp/goals-shots}"
NATIVE_APP="$ROOT/ios/build/Build/Products/Release-iphonesimulator/Goals.app"
NATIVE_LOG="$ROOT/ios/build/goals-native-build.log"

# CocoaPods and Xcode script phases break without a UTF-8 locale in
# non-interactive shells; a stale DEVELOPER_DIR points at a removed Xcode beta.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
unset DEVELOPER_DIR

die() { echo "error: $*" >&2; exit 1; }

booted_udid() {
  xcrun simctl list devices booted -j | python3 -c '
import json, sys
devs = json.load(sys.stdin)["devices"]
ids = [d["udid"] for v in devs.values() for d in v if d["state"] == "Booted"]
print(ids[0] if ids else "")'
}

app_path()  { xcrun simctl get_app_container "$DEVICE" "$BUNDLE_ID" app 2>/dev/null; }
data_path() { xcrun simctl get_app_container "$DEVICE" "$BUNDLE_ID" data 2>/dev/null; }

cmd_doctor() {
  echo "xcode:   $(xcodebuild -version 2>/dev/null | head -1)"
  echo "node:    $(node -v 2>/dev/null || echo missing)"
  echo "booted:  $(booted_udid || true)"
  local app; app=$(app_path)
  if [ -n "$app" ]; then
    echo "app:     $app"
    echo "sdk:     $(plutil -extract DTSDKName raw "$app/Info.plist" 2>/dev/null)"
    echo "bundle:  $(stat -f '%z bytes, %Sm' "$app/main.jsbundle" 2>/dev/null)"
  else
    echo "app:     not installed (run build-native)"
  fi
  if [ -f "$ROOT/.env" ]; then
    echo "env:     $(sed -E 's/=.*//' "$ROOT/.env" | tr '\n' ' ')"
  else
    echo "env:     .env missing (copy .env.example)"
  fi
  echo "native:  $([ -d "$NATIVE_APP" ] && echo "$NATIVE_APP" || echo 'no build yet')"
  echo "disk:    $(df -h / | awk 'NR==2 {print $4" free"}')"
}

cmd_boot() {
  local name="${1:-iPhone 16 Pro}"
  if [ -z "$(booted_udid)" ]; then
    xcrun simctl boot "$name" || die "could not boot '$name' (xcrun simctl list devices)"
  fi
  open -a Simulator
  echo "booted: $(booted_udid)"
}

cmd_launch()  { xcrun simctl launch "$DEVICE" "$BUNDLE_ID"; }
cmd_stop()    { xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true; }
cmd_restart() { cmd_stop; sleep 1; cmd_launch; }

# Fast path: rebuild only the JS bundle straight into the installed Release app.
cmd_bundle() {
  local app; app=$(app_path)
  [ -n "$app" ] || die "app not installed on $DEVICE; run build-native first"
  (cd "$ROOT" && npx expo export:embed --platform ios --dev false \
      --entry-file index.ts --bundle-output "$app/main.jsbundle" --assets-dest "$app") \
    | tail -2
  cmd_restart
}

# Full native build. Only needed after native changes (new native package,
# app.json plugins, Podfile). Takes minutes, not seconds.
cmd_build_native() {
  local start rc; start=$(date +%s)
  mkdir -p "$ROOT/ios/build"
  (cd "$ROOT/ios" && xcodebuild -workspace Goals.xcworkspace -scheme Goals \
      -configuration Release -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath build CODE_SIGNING_ALLOWED=NO build) > "$NATIVE_LOG" 2>&1
  rc=$?
  echo "xcodebuild exit=$rc after $(( $(date +%s) - start ))s, log: $NATIVE_LOG"
  grep -E "error:|BUILD SUCCEEDED|BUILD FAILED" "$NATIVE_LOG" | tail -10
  [ $rc -eq 0 ] || exit $rc
  cmd_install
}

cmd_install() {
  [ -d "$NATIVE_APP" ] || die "no native build at $NATIVE_APP"
  xcrun simctl install "$DEVICE" "$NATIVE_APP" && echo "installed $NATIVE_APP"
}

# Right after launch/restart the simulator shows a black launch frame, then the
# app's loading spinner on the ocean backdrop. File size can't tell these apart
# (a flat paper screen is smaller than the black frame), so sample a 64px BMP:
# the middle band must not be black, and three samples in a row must match after
# coarse quantization, i.e. the spinner is gone and the screen has settled.
wait_rendered() {
  local probe="$SHOTS/.probe.png" bmp="$SHOTS/.probe.bmp" prev="" same=0 i out
  for i in $(seq 1 40); do
    xcrun simctl io "$DEVICE" screenshot "$probe" >/dev/null 2>&1 || return 1
    sips -Z 64 -s format bmp "$probe" --out "$bmp" >/dev/null 2>&1
    out=$(python3 - "$bmp" <<'PY'
import hashlib, struct, sys
data = open(sys.argv[1], "rb").read()
off = struct.unpack_from("<I", data, 10)[0]
w, h = struct.unpack_from("<ii", data, 18)
bpp = struct.unpack_from("<H", data, 28)[0] // 8
h = abs(h); row = (w * bpp + 3) & ~3
band = [data[off + y*row + x*bpp + c]
        for y in range(int(h*0.2), int(h*0.8)) for x in range(w) for c in range(3)]
mean = sum(band) / len(band)
print("%.0f %s" % (mean, hashlib.md5(bytes(v >> 4 for v in band)).hexdigest()))
PY
)
    local mean="${out%% *}" sig="${out#* }"
    if [ "${mean:-0}" -gt 25 ] && [ "$sig" = "$prev" ]; then
      same=$((same + 1))
      if [ "$same" -ge 2 ]; then rm -f "$probe" "$bmp"; return 0; fi
    else
      same=0
    fi
    prev="$sig"
    sleep 0.3
  done
  rm -f "$probe" "$bmp"
  return 1
}

# Screenshot to $SHOTS/<name>.png plus a downscaled <name>.small.png that is
# cheap to read back as an image.
cmd_shot() {
  local name="${1:-shot-$(date +%H%M%S)}"
  mkdir -p "$SHOTS"
  local f="$SHOTS/$name.png"
  wait_rendered || echo "warning: screen not settled after ~25 s, capturing anyway" >&2
  xcrun simctl io "$DEVICE" screenshot "$f" >/dev/null 2>&1 || die "screenshot failed"
  sips -Z 900 "$f" --out "$SHOTS/$name.small.png" >/dev/null 2>&1
  echo "$f"
  echo "$SHOTS/$name.small.png"
}

# App logs from the unified log. Default: only JS console output
# (subsystem com.facebook.react.log). `logs all [secs] [lines]` adds native and
# network noise.
cmd_logs() {
  local predicate='process == "Goals" AND subsystem == "com.facebook.react.log"'
  if [ "${1:-}" = "all" ]; then predicate='process == "Goals"'; shift; fi
  local secs="${1:-600}" lines="${2:-60}"
  xcrun simctl spawn "$DEVICE" log show --last "${secs}s" --style compact \
      --predicate "$predicate" 2>/dev/null \
    | grep -vE '^(Timestamp|Filtering)' | tail -n "$lines"
}

# Persisted app state (AsyncStorage) without printing tokens: explains
# "why is it logged out / why did the setup vanish".
cmd_state() {
  local data; data=$(data_path)
  [ -n "$data" ] || die "app not installed"
  python3 - "$data/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1" <<'PY'
import hashlib, json, os, sys
root = sys.argv[1]
manifest = json.load(open(os.path.join(root, "manifest.json")))
def value(key):
    raw = manifest.get(key)
    if raw is None:
        path = os.path.join(root, hashlib.md5(key.encode()).hexdigest())
        raw = open(path).read() if os.path.exists(path) else None
    return raw
print("keys:", ", ".join(sorted(manifest)))
raw = value("goals-app-state-v3")
if raw:
    st = json.loads(raw).get("state", {})
    uc = st.get("userConfig") or {}
    print("signed in (userConfig):", bool(uc), "| onboarding_complete:", uc.get("onboarding_complete"))
    print("focusStyle:", st.get("focusStyle"), "| lastSessionMinutes:", st.get("lastSessionMinutes"))
    po = st.get("pendingOnboarding")
    print("pendingOnboarding:", json.dumps(po) if po else None)
    print("activeSession:", bool(st.get("activeSession")))
PY
}

cmd_location() {
  case "${1:-}" in
    "") die "usage: location <lat>,<lon> | clear" ;;
    clear) xcrun simctl location "$DEVICE" clear ;;
    *) xcrun simctl location "$DEVICE" set "$1" ;;
  esac
}

cmd_grant()      { xcrun simctl privacy "$DEVICE" grant "${1:-location-always}" "$BUNDLE_ID"; }
cmd_appearance() { xcrun simctl ui "$DEVICE" appearance "${1:-light}"; }
cmd_statusbar()  {
  xcrun simctl status_bar "$DEVICE" override --time 9:41 \
    --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4
}

cmd_test() { (cd "$ROOT" && npm run typecheck && npm run test:domain); }

usage() {
  sed -n '2,4p' "${BASH_SOURCE[0]}"
  cat <<'TXT'
commands:
  doctor                 toolchain, booted device, installed app, .env keys, disk
  boot [device name]     boot a simulator (default iPhone 16 Pro) and open Simulator.app
  bundle                 FAST: rebuild JS bundle into the installed app + restart (~15 s)
  build-native           full Release simulator build into ios/build + install (minutes)
  install                install ios/build/.../Goals.app on the device
  launch | stop | restart
  shot [name]            screenshot -> /tmp/goals-shots/<name>.png (+ .small.png)
  logs [all] [secs] [lines]  JS console output (default last 600 s); "all" = native too
  state                  persisted AsyncStorage summary (sign-in, pending setup)
  location <lat>,<lon> | clear   simulated GPS (Auto Check-In / geofences)
  grant [service]        privacy grant, default location-always
  appearance light|dark
  statusbar              clean status bar for screenshots
  test                   typecheck + domain smoke tests
TXT
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  doctor) cmd_doctor ;;
  boot) cmd_boot "$@" ;;
  bundle) cmd_bundle ;;
  build-native) cmd_build_native ;;
  install) cmd_install ;;
  launch) cmd_launch ;;
  stop) cmd_stop ;;
  restart) cmd_restart ;;
  shot) cmd_shot "$@" ;;
  logs) cmd_logs "$@" ;;
  state) cmd_state ;;
  location) cmd_location "$@" ;;
  grant) cmd_grant "$@" ;;
  appearance) cmd_appearance "$@" ;;
  statusbar) cmd_statusbar ;;
  test) cmd_test ;;
  help|-h|--help) usage ;;
  *) usage; exit 2 ;;
esac
