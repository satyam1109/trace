"""Verify optional receipt-time location with synthetic SMS and mocked AOSP fixes.

Refuses physical devices and every AVD except TraceMoneyMVP. Grants/revokes location
permissions only on that isolated emulator. Never reads a real phone's location.
Requires the app and its matching test APK to be installed before running.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = 'com.tracemymoney'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--serial', default='emulator-5580')
args = parser.parse_args()
sdk = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library/Android/sdk'))
base = [str(sdk / 'platform-tools/adb'), '-s', args.serial]


def adb(*parts, check=True):
    return subprocess.run(base + list(parts), capture_output=True, text=True, check=check, timeout=30).stdout.strip()


if not args.serial.startswith('emulator-') or adb('emu', 'avd', 'name').splitlines()[0] != 'TraceMoneyMVP':
    raise SystemExit('Only the isolated TraceMoneyMVP emulator is supported')

checks = []


def run_phase(phase, reference=None):
    adb('shell', 'am', 'force-stop', PACKAGE)
    reference = reference or str(time.time_ns() // 1_000_000)
    with tempfile.NamedTemporaryFile(mode='w+t') as output:
        process = subprocess.Popen(base + ['shell', 'am', 'instrument', '-w', '-e', 'phase', phase,
                                          '-e', 'reference', reference,
                                          PACKAGE + '.test/com.tracemymoney.ledger.LendingVerification'],
                                   stdout=output, stderr=subprocess.STDOUT, text=True)
        try:
            if phase not in ('location-denied', 'location-reset', 'location-enable', 'location-inspect'):
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    text = Path(output.name).read_text()
                    if 'ready=inject-location-sms' in text:
                        message = 'Your A/c XX1234 debited by INR 321.00 to Example Location via UPI. Ref ' + reference + '.'
                        adb('emu', 'sms', 'send', 'VM-HDFCBK', message)
                        break
                    if process.poll() is not None:
                        raise AssertionError(text)
                    time.sleep(0.2)
                else:
                    raise AssertionError('Native location test did not request its synthetic SMS')
            process.wait(timeout=45)
            text = Path(output.name).read_text()
            if 'INSTRUMENTATION_RESULT: result=PASS' not in text:
                raise AssertionError(text)
            section = text.split('INSTRUMENTATION_RESULT: checks=', 1)[1].split('INSTRUMENTATION_RESULT:', 1)[0]
            for name in section.strip().splitlines():
                checks.append(name)
                print('PASS: ' + name, flush=True)
        finally:
            if process.poll() is None:
                process.terminate()
                adb('shell', 'am', 'force-stop', PACKAGE, check=False)


old_services = adb('shell', 'cmd', 'location', 'is-location-enabled')
try:
    for permission in ('ACCESS_BACKGROUND_LOCATION', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'):
        adb('shell', 'pm', 'revoke', PACKAGE, 'android.permission.' + permission, check=False)
    run_phase('location-reset')
    run_phase('location-denied')
    for permission in ('ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION'):
        adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.' + permission)
    adb('shell', 'cmd', 'location', 'set-location-enabled', 'true')
    adb('shell', 'appops', 'set', PACKAGE, 'android:mock_location', 'allow')
    run_phase('location')
    adb('shell', 'pm', 'revoke', PACKAGE, 'android.permission.ACCESS_FINE_LOCATION')
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.ACCESS_BACKGROUND_LOCATION')
    run_phase('location-approx')
    # A shell-owned mock provider survives the application's process death.
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.ACCESS_FINE_LOCATION')
    adb('shell', 'appops', 'set', 'com.android.shell', 'android:mock_location', 'allow')
    adb('shell', 'cmd', 'location', 'providers', 'add-test-provider', 'gps')
    adb('shell', 'cmd', 'location', 'providers', 'set-test-provider-enabled', 'gps', 'true')
    run_phase('location-enable')
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    adb('shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.HOME')
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        adb('shell', 'am', 'kill', PACKAGE)
        if not adb('shell', 'pidof', PACKAGE, check=False):
            break
        time.sleep(0.5)
    else:
        raise AssertionError('App did not enter the stopped-process test state')
    checks.append('Application process is absent before the location-bearing debit SMS')
    print('PASS: ' + checks[-1], flush=True)
    adb('shell', 'cmd', 'location', 'providers', 'set-test-provider-location', 'gps', '--location', '28.6139,77.2090', '--accuracy', '25')
    reference = str(time.time_ns() // 1_000_000)
    adb('emu', 'sms', 'send', 'VM-HDFCBK', 'Your A/c XX1234 debited by INR 321.00 to Example Location via UPI. Ref ' + reference + '.')
    time.sleep(7)  # Let the bounded native request complete before inspecting its encrypted record.
    run_phase('location-inspect', reference)
finally:
    run_phase('location-reset')
    adb('shell', 'cmd', 'location', 'providers', 'remove-test-provider', 'gps', check=False)
    adb('shell', 'appops', 'set', 'com.android.shell', 'android:mock_location', 'default', check=False)
    adb('shell', 'cmd', 'location', 'set-location-enabled', 'true' if old_services == 'true' else 'false', check=False)
    adb('shell', 'appops', 'set', PACKAGE, 'android:mock_location', 'default', check=False)

report = {
    'version': '0.2.0', 'versionCode': 12,
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'apkSha256': hashlib.sha256((ROOT / 'artifacts/trace-android-preview.apk').read_bytes()).hexdigest(),
    'device': 'TraceMoneyMVP AOSP ARM64 emulator', 'mockLocationsOnly': True,
    'syntheticSmsOnly': True, 'physicalDeviceVerified': False, 'checks': checks,
}
destination = ROOT / 'artifacts/location-check.json'
destination.write_text(json.dumps(report, indent=2) + '\n')
print('Report: ' + str(destination), flush=True)
