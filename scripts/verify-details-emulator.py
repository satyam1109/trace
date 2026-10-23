"""Verify manual entry, encrypted metadata and discard on the synthetic test AVD."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = 'com.tracemymoney'
sdk = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library/Android/sdk'))
base = [str(sdk / 'platform-tools/adb'), '-s', 'emulator-5580']

def adb(*args, check=True):
    return subprocess.run(base + list(args), capture_output=True, text=True, timeout=60, check=check).stdout.strip()

if adb('shell', 'getprop', 'ro.kernel.qemu') != '1' or adb('emu', 'avd', 'name').splitlines()[0] != 'TraceMoneyMVP':
    raise SystemExit('Only the synthetic TraceMoneyMVP emulator is supported')
apk = ROOT / 'artifacts/trace-android-preview.apk'
path = adb('shell', 'pm', 'path', PACKAGE).splitlines()[0].removeprefix('package:')
installed = subprocess.run(base + ['exec-out', 'su', '0', 'cat', path], capture_output=True, timeout=30, check=True).stdout
apk_hash = hashlib.sha256(apk.read_bytes()).hexdigest()
assert hashlib.sha256(installed).hexdigest() == apk_hash, 'Installed APK differs from deliverable'
checks = {}

def phase(name):
    adb('shell', 'am', 'force-stop', PACKAGE)
    output = adb('shell', 'am', 'instrument', '-w', '-e', 'phase', name, PACKAGE + '.test/com.tracemymoney.ledger.LendingVerification')
    if 'INSTRUMENTATION_RESULT: result=PASS' not in output:
        raise AssertionError(output)
    section = output.split('INSTRUMENTATION_RESULT: checks=', 1)[1].split('INSTRUMENTATION_RESULT:', 1)[0]
    checks[name] = section.strip().splitlines()
    for name in checks[name]:
        print('PASS: ' + name, flush=True)

sms_granted = 'android.permission.RECEIVE_SMS: granted=true' in adb('shell', 'dumpsys', 'package', PACKAGE)
try:
    adb('shell', 'pm', 'revoke', PACKAGE, 'android.permission.RECEIVE_SMS', check=False)
    assert 'android.permission.RECEIVE_SMS: granted=true' not in adb('shell', 'dumpsys', 'package', PACKAGE)
    for name in ['manual-prepare', 'manual-verify', 'manual-ui']:
        phase(name)
finally:
    if sms_granted:
        adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.RECEIVE_SMS')
for name in ['prepare', 'verify', 'discard']:
    phase(name)
report = {
    'version': '0.2.0', 'versionCode': 12,
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'apkSha256': apk_hash,
    'device': 'TraceMoneyMVP AOSP ARM64 emulator', 'syntheticDataOnly': True,
    'physicalDeviceVerified': False, 'manualTestSmsPermission': 'denied', 'phases': checks,
}
destination = ROOT / 'artifacts/manual-entry-check.json'
destination.write_text(json.dumps(report, indent=2) + '\n')
print('Report: ' + str(destination), flush=True)
