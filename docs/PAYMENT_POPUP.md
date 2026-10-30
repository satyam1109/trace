# Payment popup — 0.2.5 build 17

A supported debit is saved to the encrypted ledger before attempting any popup.
There is no required form. This remains true with popup permission denied,
notifications disabled, no category selected or no remarks entered.

## Compact first

The native Android popup slides upward near the bottom of the screen. It starts
as a small rounded card with only a drag handle and the payment summary:

```text
trace. / PAYMENT DETECTED
₹240.00
To Example Cafe
UPI · HDFC Bank · ••1234
```

These are illustrative values; the card uses the detected payment's actual
amount, method, bank, available masked suffix and recipient. Missing recipients
show “Unknown recipient”; account digits are omitted when unavailable. Long
recipients are capped at two lines in the compact card.

The surrounding screen is undimmed. A transparent host behind the compact card
receives outside taps solely to dismiss it; that tap is not forwarded to an
underlying app or payment button. An outside tap or downward swipe dismisses the card immediately, retaining the
payment. Ignoring it closes it after **five seconds**. No keyboard opens on entry.

## Preserve the current screen

The payment editor has no task affinity with the main app. Both automatic alerts
and notification taps use the same isolated launch intent, with a transaction-
specific URI so separate payments cannot reuse the wrong card. The task is hidden
from Recents and removed when finished. It never brings the Trace launcher task
forward. Home or the app already in use remains visible behind the translucent
card and returns to the foreground when the card closes. The transparent host
avoids Android's cross-task input sink swallowing outside taps; all visible
content, blur and animation remain on the small dialog window. System app-launch preview
and window transitions are disabled; the card keeps its own slide/scale animation.

This follows Android's [special notification activity guidance](https://developer.android.com/develop/ui/views/notifications/navigation).
When app lock is enabled, automatic popups remain suppressed. An explicit tap
on a private notification can open the locked app; an automatic launch cannot.

## Expand when wanted

Swipe upward on the summary/handle or tap it to expand. The sheet grows upward
with a short animation and a light backdrop, revealing optional **Remarks**, a
**Category** dropdown and **Save**. The header remains available to collapse it;
a downward swipe also collapses the expanded sheet. Collapsing preserves drafts.
Remarks allow 500 characters. Category offers Expense (uncategorised), Food,
Clothes, Groceries, Travel, Bills & utilities, Health, Entertainment, Other and
Lent money. Edit still reveals the native recipient field; the browser sample's
Edit details opens the full, untimed transaction editor.

Opening the sheet, focusing an input, typing or interacting with controls resets
the deadline to **ten seconds from the latest interaction**. This is an idle
window; it does not accumulate repeated extensions. A held drag pauses closing.
The category chooser and discard confirmation pause the countdown until closed.
Keep entry or Android Back on confirmation retains the payment.

**Save** writes the optional fields and closes immediately with a short slide-out.
Otherwise the current fields save on expiry. Native drafts write after a 250ms
debounce and flush on Back, outside dismissal or app switching. Reopening a
notification preserves existing remarks/category. Configuration recreation keeps
the draft, expanded state and monotonic deadline. Save failures reveal/retain the
editor for retry. Late writes cannot recreate discarded records; serialized
location and metadata writes preserve each other.

## Finish and accessibility

The Quiet palette follows the saved light/dark/system preference, with warm paper
or charcoal, restrained typography and a subtle border. The entire dialog starts
hidden before its first frame, then slides and scales gently into place over
480ms with settling. Android 12+ cross-window blur is used when the device
supports and enables it. A listener switches to an opaque surface when blur is
disabled, including by device/system policy. This is an Android
adaptation, not Apple's Liquid Glass framework. Native FLAG_SECURE remains on;
no screenshot capture of underlying apps is used to create blur.

Android animator settings disable entry/exit/height motion when animations are
turned off. The sample counterpart respects reduced motion and browser reduced
transparency settings. Tap and accessible header actions provide an alternative
to swiping. Compact optional controls are hidden from accessibility/focus until
expanded. Scrollable content handles shorter screens and the keyboard. No new
permission, dependency, networking or rejected-SMS collection was introduced.

## Verification

Install the release APK and matching Android test APK on the isolated TraceMoneyMVP
AVD. `python3 scripts/verify-popup-emulator.py` refuses physical phones and checks
task isolation over Android Settings and the launcher (including an existing
Trace task, no launcher activity, and a notification tap), compact geometry,
undimmed/non-modal flags, a real upward finger gesture,
collapse/reopen, five/ten-second timing, automatic metadata saving, picker pause,
Save, optional fields, lending, immediate outside/downward dismissal and encrypted
persistence after process restart. Only its synthetic records are removed.
Results: `artifacts/popup-check.json`. Repeat with `--blur-disabled` to exercise
the opaque fallback; the script restores the previous emulator blur setting and
writes `artifacts/popup-glass-check.json`.

The browser interaction suite covers both sheet states alongside existing history,
manual entry and discard flows. Synthetic previews:
`artifacts/payment-popup-compact-mobile.png` and
`artifacts/payment-popup-expanded-mobile.png`. These show the browser counterpart;
native private content remains protected by FLAG_SECURE.

The SMS telephony smoke replay and location regression separately check capture
and optional GPS capture against the delivered APK hash. Emulator results do not
establish physical-device reliability. Update a phone with
`adb install --no-streaming -r`; never uninstall or clear its data for this update.

## Remembered vendor categories (build 15)

The popup remains visible for repeat vendors. A remembered expense category is assigned before persistence, displayed in the compact summary and preselected in the expanded picker. Explicit category choices upsert vendor memory; passive saves and remarks do not. See [vendor memory](VENDOR_MEMORY.md) for storage, matching and deletion behaviour.
