# Test Trace on a Nothing Phone (2a)

This is a standalone, ARM64 Android test APK. It does not require Metro, a browser,
Android Studio, mobile data or Wi-Fi to receive and parse an SMS after installation.
The phone does need normal cellular SMS reception. The current APK is internally
signed with the development key; public distribution is not configured.

## Install from this Mac using USB

1. On the phone, search Settings for **Build number** (normally under About phone
   and Software info). Tap it seven times and complete the phone's unlock prompt
   to enable developer options. Labels depend on your Nothing OS version.
2. Search Settings for **USB debugging**, then enable it in Developer options.
3. Connect the phone to this Mac with a USB data cable. Unlock the phone and
   approve the USB debugging prompt for your own Mac.
4. Open Terminal on the Mac and run:

   ```sh
   /Users/satyamsingh/Library/Android/sdk/platform-tools/adb devices -l
   /Users/satyamsingh/Library/Android/sdk/platform-tools/adb -d install --no-streaming -r /Users/satyamsingh/Desktop/projects/tracemymoney/artifacts/trace-android-preview.apk
   ```

   `-d` selects the physical USB device rather than the emulator. If it says
   `unauthorized`, unlock the phone and approve the computer prompt. If it lists
   more than one physical device, disconnect the other device before installing.
   `--no-streaming` copies the APK before installation. This method successfully
   installed the preview on a physical Phone (2a), model A142 running Android 15,
   after the default streamed installation stalled. Installation and launch are
   verified on that phone; real bank-SMS detection still needs its acceptance test.
5. Open **Trace** from the phone's launcher. Once installed, USB debugging can be
   turned off and the cable disconnected; SMS detection works independently.

Alternatively, manually copy the APK to the phone using a file-sharing service
you already use. Open the APK and, if prompted, allow installation from that
specific browser/file app. Turn its **Allow from this source** setting off after
installation. Keep Play Protect enabled. If Android blocks SMS permission for a
sideloaded installation, use the USB development installation above and report
the exact permission error; do not grant unrelated permissions.

## Enable detection and prompts

Open **Set up detection** in Trace, read the disclosure, and enable detection.
In **Privacy & settings**, the live workspace should show:

| Setting | Value | Purpose |
| --- | --- | --- |
| Incoming SMS | Enabled | Receives future SMS and checks supported bank templates |
| Notifications | Enabled | Shows a private notification when a payment is captured |
| Floating payment prompt | Enabled | Allows the payment dialog above other apps while unlocked |
| Detection | Active (button says Pause detection) | Enables the receiver's parser and capture path |

Use Trace's **Popup permission** button to open Android's special access
settings. Enable **Display over other apps** for **Trace**. You can also search
phone Settings for “Display over other apps”.

Long-press **Trace** in the launcher, then choose **App info**:

- **Permissions → SMS → Allow**.
- **Notifications → Allow notifications**. Keep the **Detected payments** channel
  enabled. DND and notification settings can suppress visible/sound alerts.
- **App battery usage → Allow background usage**. Select **Unrestricted** if your
  version provides that option, rather than Restricted. Nothing OS labels vary;
  use Settings search if necessary. Start the first test with Battery Saver off.
- If **Pause app activity if unused** or **Remove permissions if app is unused**
  appears, turn that off for Trace if you intend to leave it unused for long
  periods while still monitoring SMS.

Nothing's [background-app guidance](https://support.nothing.tech/hc/en-us/articles/27015749105809-My-apps-won-t-run-What-can-I-do)
recommends checking battery optimisation when background apps do not run.
Exact menu paths depend on the installed OS version.

No default-SMS-app change, accessibility service or PhonePe/Paytm login is
required. Location permission is optional and needed only if you enable location
capture. Android's incoming-SMS permission is broad; filtering
happens inside Trace, and there is no bank-only SMS permission. This build saves
only parsed transaction details and does not persist raw SMS bodies.

## Verify the real SMS path on your phone

The in-app **Sample payment** button tests the parser and UI, but does not prove
that the phone delivers real SMS broadcasts to Trace.

1. Complete setup, switch to the live workspace, then leave Trace using Home.
2. After your next normal payment, confirm the **bank debit SMS** has actually
   arrived in your SMS inbox. A PhonePe/Paytm success screen alone is not the input.
3. With the phone unlocked, look for Trace's popup or private notification.
   Ignore the popup for five seconds, then check the live transaction history for
   exactly one record with the same debit amount. The record is saved before the
   popup; the countdown closes the prompt.
4. On a later payment, repeat while Trace is out of the recent-apps list. Normal
   process removal differs from **Force stop**. If you use Force stop, reopen
   Trace before expecting detection to resume.
5. Repeat once with the screen locked: a floating dialog is deliberately not
   shown over the lock screen. Unlock and check history. Notification lock-screen
   details are intentionally private. After restarting the phone, unlock it once
   before testing; this version does not process SMS before first unlock.

Preview 0.1.3 covers selected English INR debit and card-spend formats across
19 bank/issuer profiles. See [the coverage matrix](SMS_RESEARCH.md) for the banks,
sender tokens and tested methods. Sender ID, wording and bank changes can still
cause a message to be ignored. Foreign-currency spends and bill reminders are
excluded. Old inbox messages are not imported, so an SMS missed while detection
or permission was disabled cannot be recovered automatically by this build.

Preview 0.1.1 fixes ICICI's `AX-ICICIT-S` format that reports both the user's debit
and the beneficiary's credit in one SMS. The earlier parser incorrectly excluded
the whole message because it contained “credited”. The fix recognises the later
beneficiary clause, three-digit masked account suffix and `UPI:` reference, while
continuing to ignore own-account credits, failed payments, OTPs and refunds.

Version 0.1.1 was installed over 0.1.0 on the physical Phone (2a), Android 15,
using `--no-streaming -r`, and launched successfully. SMS, notification and
floating-prompt permissions remained enabled after updating. The user subsequently
confirmed the corrected ICICI format works on the phone.

Preview 0.1.2 additionally recognises the reported HDFC `CP-HDFCBN-S` message
beginning `Sent Rs… From HDFC Bank A/C… To…`. If the message does not identify UPI
or a card, its payment method remains Bank rather than guessing the payment app.
Existing missed messages still are not imported automatically.

Version 0.1.2 was subsequently installed in place and launched on the same physical
Phone (2a). SMS and notification permissions and display-over-other-apps access
remained enabled. The reported HDFC format passed emulator SMS capture, popup,
timeout and deduplication checks. The user subsequently confirmed HDFC detection
works on the phone too. Version 0.1.3 build 5 was subsequently installed in place
and launched successfully on this Phone (2a). SMS, notification and floating-prompt
permissions remained enabled. Additional real-bank/card and lending acceptance
checks on the phone remain pending.

The updated 0.1.3 preview (build 5) also adds **Lent money**. After installation,
open **Transactions**, tap a saved payment, select **Lent money** under Category
and save. Its new tab shows the total marked as lent and those payments across
all dates. You can change the category back to Expense without deleting the
payment. This update preserves existing records; do not uninstall first. See
[the lending guide](LENT_MONEY.md) for details.

Build 6 adds a confirmation before discarding a payment (including from the SMS
popup) and removes the exterior side margins from mobile transaction editing.
It passed emulator and browser checks. The phone disconnected before installation,
so build 6 was not installed on this phone.

Build 7 replaced the green styling with navy and
gold across the app, SMS popup and launcher icon. All lending and discard
confirmation flows remain. It updates in place using the same application ID and
signing key. The phone is not connected during this build's verification, so its
installation remains pending.

The latest APK is build 11. The payment popup now starts as a compact animated bottom card. Swipe up or tap it to reveal optional Remarks, Category and Save. Swipe down to collapse, or tap outside to dismiss while keeping the payment. Glass-style blur follows Android support, with an opaque fallback. As before, it closes after five seconds untouched or ten seconds after the most recent edit. Opening the category list pauses the countdown. It adds the centre **+ Create** button for cash or missed payments, plus the reported HDFC card merchant format. Manual entries do not need SMS or location permissions. It adds **Remarks** below Recipient and replaces the category selector with
a dropdown including Food, Clothes, Groceries, Travel, Other and Lent money.
It also adds optional location capture for newly detected debits. Open
**Privacy & settings → Payment location → Enable location capture**. Allow
foreground location, then use **Location permission settings → Permissions →
Location → Allow all the time** for capture while Trace is closed. Turn on the
phone's Location setting too. Approximate access works. A fresh location may be
unavailable; the debit is still saved. This labels location near SMS receipt,
which can differ from the payment place when a message is delayed. See
[remarks, categories and location setup](DETAILS_AND_LOCATION.md).

In **Privacy & settings → SMS receiver status**, the new version shows a checked
message count, last receipt time and result. This distinguishes unsupported
senders/formats, paused detection, processing errors, duplicates and saved
payments. The status contains no raw message, sender, amount or recipient. It
starts collecting after this update and shows the most recent incoming SMS,
which could be unrelated to a payment. Deleting all local records also clears it.

If the SMS arrives but no payment appears, check detection, SMS permission and
the live workspace first. If a payment appears but no popup does, check floating
access, notifications, lock state and battery restrictions. If those are correct,
provide the sender ID and a **redacted** example of the debit template, preserving
its structure but replacing personal account/recipient/reference details. Never
share OTPs or full account/card numbers.

## What has been verified

The artifact's incoming-SMS path is tested using Android's telephony emulator,
not only the app simulator. The replay verifies cold process startup, HDFC debit,
ICICI card spend, multipart SBI delivery, popup timeout, duplicate/OTP/failure/
credit/reversal rejection, notification fallback and retained encrypted records.
The expanded 0.1.3 replay also captured all 28 researched examples across the
19 profiles and ignored all 98 researched counterexamples. These use synthetic
SMS on the isolated emulator.

See `artifacts/sms-detection-check.json` for the exact APK hash and results.
Run `python3 scripts/verify-sms-emulator.py` against the already configured,
synthetic-only `TraceMoneyMVP` AOSP emulator to repeat it. The script refuses
physical devices and requires the development emulator's existing root access
only to inspect its test database. **No rooting is required on your phone.**

The reported HDFC and ICICI templates have user-confirmed real-bank delivery on
Phone (2a). Additional bank/card templates, Nothing OS battery behaviour and
locked-screen behaviour still need physical-device checks.
