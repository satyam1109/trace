"""Verify the native compact/expanded payment popup on the synthetic AVD only."""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = 'com.tracemymoney'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--blur-disabled', action='store_true', help='Verify compact popup with Android cross-window blur disabled, restoring its previous setting')
args = parser.parse_args()
sdk = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library/Android/sdk'))
base = [str(sdk / 'platform-tools/adb'), '-s', 'emulator-5580']
def adb(*parts, binary=False):
    result = subprocess.run(base + list(parts), capture_output=True, timeout=90, check=True)
    return result.stdout if binary else result.stdout.decode().strip()
if adb('shell', 'getprop', 'ro.kernel.qemu') != '1' or adb('emu', 'avd', 'name').splitlines()[0] != 'TraceMoneyMVP':
    raise SystemExit('Only the isolated TraceMoneyMVP emulator is permitted')
sha = hashlib.sha256((ROOT / 'artifacts/trace-android-preview.apk').read_bytes()).hexdigest()
installed = adb('shell', 'pm', 'path', PACKAGE).splitlines()[0].removeprefix('package:')
assert hashlib.sha256(adb('exec-out', 'su', '0', 'cat', installed, binary=True)).hexdigest() == sha
original_blur = adb('shell', 'wm', 'disable-blur') if args.blur_disabled else ''
phases = {}
steps = ['popup-task', 'popup-reset', 'popup-idle', 'popup-edit', 'popup-actions', 'popup-dismiss', 'popup-verify']
if args.blur_disabled:
    steps = ['popup-reset', 'popup-idle', 'popup-cleanup']
try:
    if args.blur_disabled:
        adb('shell', 'su', '0', 'wm', 'disable-blur', '1')
        assert 'Blur enabled: false' in adb('shell', 'wm', 'disable-blur')
    for step in steps:
        phase = 'popup-reset' if step == 'popup-cleanup' else step
        adb('shell', 'am', 'force-stop', PACKAGE)
        output = adb('shell', 'am', 'instrument', '-w', '-e', 'phase', phase, PACKAGE + '.test/com.tracemymoney.ledger.LendingVerification')
        if 'INSTRUMENTATION_RESULT: result=PASS' not in output:
            raise AssertionError(output)
        section = output.split('INSTRUMENTATION_RESULT: checks=', 1)[1].split('INSTRUMENTATION_RESULT:', 1)[0]
        phases[step] = section.strip().splitlines()
        for check in phases[step]:
            print('PASS: ' + check, flush=True)
finally:
    if args.blur_disabled:
        adb('shell', 'su', '0', 'wm', 'disable-blur', '0' if 'Blur enabled: true' in original_blur else '1')
metadata = json.loads((ROOT / 'android/app/build/outputs/apk/release/output-metadata.json').read_text())['elements'][0]
report = dict(version=metadata['versionName'], versionCode=metadata['versionCode'], checkedAt=datetime.now(timezone.utc).isoformat(), apkSha256=sha,
              device='TraceMoneyMVP AOSP ARM64 emulator', syntheticDataOnly=True, physicalDeviceVerified=False,
              initialTimeoutSeconds=5, interactionIdleTimeoutSeconds=10, blurDisabledForCheck=args.blur_disabled, phases=phases)
name = 'popup-glass-check.json' if args.blur_disabled else 'popup-check.json'
destination = ROOT / 'artifacts' / name
destination.write_text(json.dumps(report, indent=2) + '\n')
print('Report: ' + str(destination), flush=True)
