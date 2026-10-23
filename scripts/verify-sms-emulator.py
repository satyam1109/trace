"""Replay synthetic SMS through a configured, rooted AOSP test emulator.

Never targets a physical phone. Requires Trace detection, SMS, notifications and
overlay access already enabled. Leaves synthetic payments in the test ledger.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = "com.tracemymoney"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--serial", default="emulator-5580")
parser.add_argument("--researched-corpus", action="store_true",
                    help="Also replay all internet-researched synthetic format cases and counterexamples")
args = parser.parse_args()
sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
adb_path = shutil.which("adb") or str(sdk / "platform-tools/adb")
checks = []


def adb(*parts, check=True, binary=False):
    result = subprocess.run(
        [adb_path, "-s", args.serial, *parts], capture_output=True, check=check,
        timeout=30,
    )
    return result.stdout if binary else result.stdout.decode(errors="replace").strip()


def expect(condition, name):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print("PASS: " + name, flush=True)


def until(predicate, timeout=8):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if predicate():
            return True
        time.sleep(0.2)
    return False


def rows():
    # Copy the database and WAL into a temporary directory. Only IDs and demo
    # flags are read; transaction payloads remain encrypted by Android Keystore.
    with tempfile.TemporaryDirectory(prefix="trace-sms-") as directory:
        path = Path(directory) / "ledger.db"
        for suffix in ("", "-wal"):
            content = adb("exec-out", "su", "0", "cat",
                          f"/data/user/0/{PACKAGE}/databases/ledger.db{suffix}",
                          check=False, binary=True)
            if content:
                Path(str(path) + suffix).write_bytes(content)
        with sqlite3.connect(path) as connection:
            return dict(connection.execute("SELECT id, demo FROM transactions"))


def diagnostics():
    content = adb("exec-out", "su", "0", "cat",
                  f"/data/user/0/{PACKAGE}/shared_prefs/ledger.smsDiagnostics.xml",
                  check=False)
    if not content or (content.startswith("cat:") and "No such file or directory" in content):
        return {}
    return {item.get("name"): item.get("value", item.text) for item in ET.fromstring(content)}


def identity(bank, account, reference, paise):
    value = f"{bank}|{account}|{reference}|{paise}"
    return "sms-" + hashlib.sha256(value.encode()).hexdigest()


def incoming(sender, body):
    # Console SMS commands use backslash escapes, not literal command newlines.
    escaped = body.replace("\\", "\\\\").replace("\r", "").replace("\n", "\\n")
    result = adb("emu", "sms", "send", sender, escaped)
    if "OK" not in result:
        raise AssertionError("Telephony emulator rejected test SMS")


def popup_visible():
    activity = adb("shell", "dumpsys", "activity", "activities")
    return any("PaymentPromptActivity" in line and
               ("topResumedActivity" in line or "mResumedActivity" in line)
               for line in activity.splitlines())


def cold_background():
    adb("shell", "am", "start", "-a", "android.intent.action.MAIN",
        "-c", "android.intent.category.HOME")
    time.sleep(0.5)
    # am kill can be ignored while Android is still transitioning the activity
    # to the background. Retry a normal kill; never force-stop SMS delivery.
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        adb("shell", "am", "kill", PACKAGE)
        if not adb("shell", "pidof", PACKAGE, check=False):
            return
        time.sleep(0.25)
    raise AssertionError("App process did not stop normally")


if not args.serial.startswith("emulator-") or adb("shell", "getprop", "ro.kernel.qemu") != "1":
    raise SystemExit("Only an isolated Android emulator is permitted")
if "uid=0" not in adb("shell", "su", "0", "id", check=False):
    raise SystemExit("Use a rooted AOSP test image; no physical phone/rooting is supported")
if adb("emu", "avd", "name").splitlines()[0] != "TraceMoneyMVP":
    raise SystemExit("Use the synthetic-only TraceMoneyMVP emulator")
permissions = adb("shell", "dumpsys", "package", PACKAGE)
for permission in ("RECEIVE_SMS", "POST_NOTIFICATIONS"):
    if not re.search(rf"android.permission.{permission}: granted=true", permissions):
        raise SystemExit(f"Complete app setup first: {permission} not granted")
settings = adb("shell", "su", "0", "cat",
               f"/data/user/0/{PACKAGE}/shared_prefs/ledger.settings.xml")
if 'name="detectionEnabled" value="true"' not in settings:
    raise SystemExit("Enable SMS detection in Trace first")
if 'name="locationEnabled" value="true"' in settings:
    raise SystemExit("Disable optional location for this baseline SMS replay; verify-location-emulator.py tests location separately")
if "SYSTEM_ALERT_WINDOW: allow" not in adb("shell", "appops", "get", PACKAGE, "SYSTEM_ALERT_WINDOW"):
    raise SystemExit("Enable floating prompts in Trace first")

apk = ROOT / "artifacts/trace-android-preview.apk"
apk_hash = hashlib.sha256(apk.read_bytes()).hexdigest()
installed_path = adb("shell", "pm", "path", PACKAGE).splitlines()[0].removeprefix("package:")
installed_hash = hashlib.sha256(adb("exec-out", "su", "0", "cat", installed_path, binary=True)).hexdigest()
expect(installed_hash == apk_hash, "Installed APK matches the deliverable SHA-256")
baseline = set(rows())
initial_sms_count = int(diagnostics().get("receivedCount", 0))
token = str(time.time_ns())[-13:]
refs = [token + str(index) for index in range(6)]
first = f"A/c XX4821 debited by INR 240.50 to Smoke Cafe via UPI. Ref {refs[0]}. Avl bal INR 90,000.00."
first_id = identity("HDFC Bank", "4821", refs[0], 24050)
cold_background()
expect(not adb("shell", "pidof", PACKAGE, check=False), "App process absent before incoming bank SMS")
incoming("VM-HDFCBK", first)
expect(until(lambda: rows().get(first_id) == 0), "Cold-start SMS receiver persists a live HDFC debit")
expect(until(popup_visible, 4), "Incoming SMS launches the native payment popup")
expect(until(lambda: not popup_visible(), 13), "Popup closes without user input after its deadline")
expect(first_id in rows(), "Payment survives popup timeout without user input")
expect(diagnostics().get("lastResult") == "saved", "Receiver diagnostics confirm that the real SMS was saved")

before_ignored = set(rows())
incoming("VM-HDFCBK", first)
expect(until(lambda: diagnostics().get("lastResult") == "duplicate"), "Receiver diagnostics explain a duplicate instead of silently ignoring it")
incoming("VM-HDFCBK", "918273 is your OTP. INR 100.00 will be debited on confirmation.")
incoming("VM-HDFCBK", "A/c XX4821 debited by INR 100.00. Transaction failed.")
incoming("VM-HDFCBK", "INR 100.00 credited to A/c XX4821.")
incoming("VM-HDFCBK", "INR 100.00 debited from A/c XX4821. Transaction reversed.")
incoming("+919876543210", "A/c XX4821 debited by INR 100.00.")
incoming("VM-HDFCBK", "Your account was debited. Avl balance INR 9,000.00.")
time.sleep(2)
expect(set(rows()) == before_ignored, "Duplicate, OTP, failure, credit, reversal, personal SMS and balance-only messages add no payments")
expect(diagnostics().get("lastResult") == "unsupported_format", "A received but unrecognised debit format is visible in diagnostics")

incoming("AD-ICICIB", f"INR 120.75 spent on ICICI Bank card ending 9164 at Smoke Shop on 19-Oct-2026. Ref {refs[1]}.")
card_id = identity("ICICI Bank", "9164", refs[1], 12075)
expect(until(lambda: rows().get(card_id) == 0), "ICICI card SMS is captured as a live payment")
expect(until(lambda: not popup_visible(), 13), "Second popup finishes automatically")

# Put the reference beyond the first SMS segment. A matching deterministic ID
# demonstrates that the real receiver reconstructed the complete multipart SMS.
multipart = ("Your A/c XX7032 debited by Rs. 799.00 to Smoke Telecom via UPI. "
             + "Test transaction details. " * 12 + f"Ref {refs[2]}.")
incoming("JD-SBIUPI-S", multipart)
multi_id = identity("SBI", "7032", refs[2], 79900)
expect(until(lambda: rows().get(multi_id) == 0), "Multipart SBI SMS is reconstructed, including its trailing reference")
expect(until(lambda: not popup_visible(), 13), "Multipart payment popup finishes automatically")

icici_body = f"ICICI Bank Acct XX123 debited for RS 1.00 on 19-Oct-26; Example Person credited. UPI: {refs[4]}. Call 1800000000 for dispute. SMS BLOCK 123 to 56789"
incoming("AX-ICICIT-S", icici_body)
icici_reported_id = identity("ICICI Bank", "123", refs[4], 100)
expect(until(lambda: rows().get(icici_reported_id) == 0), "Full reported ICICI format with credited beneficiary passes through the real SMS receiver")
expect(until(lambda: not popup_visible(), 13), "Reported ICICI format popup finishes automatically")
before_repeat = set(rows())
incoming("AX-ICICIT-S", icici_body)
expect(until(lambda: diagnostics().get("lastResult") == "duplicate") and set(rows()) == before_repeat,
       "UPI colon reference prevents duplicate ICICI payments")

fixtures = {
    fields[0]: fields
    for line in (ROOT / "testdata/bank-sms.tsv").read_text().splitlines()
    if line.strip() and not line.startswith("#")
    for fields in [line.split("\t")]
}
hdfc = fixtures["hdfc-sent-reported"]
hdfc_body = hdfc[8].replace(hdfc[7], refs[5]).replace("\\n", "\n")
incoming(hdfc[1], hdfc_body)
hdfc_sent_id = identity(hdfc[3], hdfc[4], refs[5], int(hdfc[2]))
expect(until(lambda: rows().get(hdfc_sent_id) == 0), "Reported HDFC Sent format from the shared corpus is captured by the real SMS receiver")
expect(until(popup_visible, 4), "HDFC Sent SMS opens a native payment popup")
expect(until(lambda: not popup_visible(), 13), "HDFC Sent payment is retained after the popup deadline")
before_hdfc_repeat = set(rows())
incoming(hdfc[1], hdfc_body)
expect(until(lambda: diagnostics().get("lastResult") == "duplicate") and set(rows()) == before_hdfc_repeat,
       "HDFC Ref prevents duplicate Sent payments")

# Original user-provided card text, including the anonymised suffix and date.
hdfc_card = fixtures["hdfc-card-user-asterisk"]
hdfc_card_body = hdfc_card[8].replace("\\n", "\n")
card_before = set(rows())
cold_background()
incoming(hdfc_card[1], hdfc_card_body)
expect(until(lambda: len(set(rows()) - card_before) == 1), "Cold receiver captures the exact reported HDFC card message with an asterisk merchant")
hdfc_card_id = next(iter(set(rows()) - card_before))
expect(rows().get(hdfc_card_id) == 0, "Reported HDFC card payment is stored as a live record")
expect(until(popup_visible, 4), "Reported HDFC card message opens the native payment popup")
expect(until(lambda: not popup_visible(), 13), "Reported HDFC card payment remains saved after its popup closes")

try:
    adb("shell", "appops", "set", PACKAGE, "SYSTEM_ALERT_WINDOW", "ignore")
    cold_background()
    incoming("VM-HDFCBK", f"A/c XX4821 debited by INR 12.34 to Smoke Fallback via UPI. Ref {refs[3]}.")
    fallback_id = identity("HDFC Bank", "4821", refs[3], 1234)
    expect(until(lambda: rows().get(fallback_id) == 0), "Capture still works with floating popup permission disabled")
    expect(not popup_visible(), "No floating popup is opened without overlay permission")
    notification = adb("shell", "dumpsys", "notification", "--noredact")
    notification_id = 0
    for character in fallback_id:
        notification_id = (31 * notification_id + ord(character)) & 0xFFFFFFFF
    if notification_id >= 0x80000000:
        notification_id -= 0x100000000
    records = notification.split("NotificationRecord(")
    expect(any(f"pkg={PACKAGE} " in record and f" id={notification_id} " in record
               and "Payment recorded privately" in record
               and "vis=SECRET" in record for record in records),
           "The new fallback payment has its own private notification")
finally:
    adb("shell", "appops", "set", PACKAGE, "SYSTEM_ALERT_WINDOW", "allow")

expanded_ids = set()
expanded_messages = 0
expanded_summary = {"positive": 0, "negative": 0, "issuers": []}
if args.researched_corpus:
    researched = [case for key, case in fixtures.items() if key.startswith("research-")]
    positive = [case for case in researched if case[2] != "IGNORE"]
    negative = [case for case in researched if case[2] == "IGNORE"]
    try:
        adb("shell", "appops", "set", PACKAGE, "SYSTEM_ALERT_WINDOW", "ignore")
        for index, case in enumerate(positive):
            key, sender, amount, bank, account, method, recipient, reference, body = case
            body = body.replace("\\n", "\n")
            fresh_reference = token + "9" + str(index).zfill(3)
            if reference != "-":
                body = body.replace(reference, fresh_reference)
            else:
                body += " Ref " + fresh_reference + "."
            cold_background()
            incoming(sender, body)
            expected_id = identity(bank, "" if account == "-" else account, fresh_reference, int(amount))
            expect(until(lambda: rows().get(expected_id) == 0),
                   "Cold receiver captures researched format: " + key)
            expanded_ids.add(expected_id)
        before_negative = set(rows())
        for case in negative:
            try:
                incoming(case[1], case[8].replace("\\n", "\n"))
            except AssertionError as error:
                raise AssertionError("Telephony transport rejected synthetic case: " + case[0]) from error
        expanded_messages = len(researched)
        expect(until(lambda: int(diagnostics().get("receivedCount", 0)) == initial_sms_count + 16 + expanded_messages, 15),
               "All researched positive and negative messages reached the receiver")
        expect(set(rows()) == before_negative,
               "Researched OTP, future, failure, statement, receipt and foreign-limit counterexamples create no expenses")
        expanded_summary = {"positive": len(positive), "negative": len(negative),
                            "issuers": sorted({case[3] for case in positive})}
    finally:
        adb("shell", "appops", "set", PACKAGE, "SYSTEM_ALERT_WINDOW", "allow")

cold_background()
adb("shell", "am", "start", "-n", PACKAGE + "/.MainActivity")
expect(set(rows()) == baseline | {first_id, card_id, multi_id, fallback_id, icici_reported_id, hdfc_sent_id, hdfc_card_id} | expanded_ids,
       "Exactly the expected live records survive app restart")
health = diagnostics()
expect(int(health.get("receivedCount", 0)) == initial_sms_count + 16 + expanded_messages,
       "Receiver diagnostics account for every injected SMS across process restarts")
expect(set(health) == {"receivedCount", "lastReceivedAt", "lastResult"},
       "Diagnostic storage contains only counts, time and a fixed result code")
report = {
    "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "apkSha256": apk_hash,
    "androidApi": adb("shell", "getprop", "ro.build.version.sdk"),
    "device": "TraceMoneyMVP AOSP ARM64 emulator",
    "syntheticSmsOnly": True,
    "researchedCorpus": expanded_summary,
    "checks": checks,
    "physicalDeviceVerified": False,
}
destination = ROOT / "artifacts/sms-detection-check.json"
destination.write_text(json.dumps(report, indent=2) + "\n")
print(f"Report: {destination}", flush=True)
