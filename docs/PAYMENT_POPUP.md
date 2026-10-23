# Payment popup — 0.1.3 build 11

A supported debit is saved to the encrypted ledger before attempting any popup.
There is no required form. This remains true with popup permission denied,
notifications disabled, no category selected or no remarks entered.

## Compact first

The native Android popup slides upward near the bottom of the screen. It starts
as a small rounded card with only a drag handle and the payment summary:

```text
trace / PAYMENT DETECTED
₹240.00
UPI · HDFC Bank · ••1234
To Example Cafe
```

These are illustrative values; the card uses the detected payment's actual
amount, method, bank, available masked suffix and recipient. Missing recipients
show “Unknown recipient”; account digits are omitted when unavailable. Long
recipients are capped at two lines in the compact card.

The surrounding screen is undimmed and the compact Android window is non-modal.
An outside tap or downward swipe dismisses the card immediately, retaining the
payment. Ignoring it closes it after **five seconds**. No keyboard opens on entry.

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

The existing navy/gold palette now has a rounded, translucent glass-style surface,
a subtle highlight and border. Android 12+ cross-window blur is used when the
device supports and enables it. A listener switches to an opaque navy gradient
when blur is disabled, including by device/system policy. This is an Android
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
compact geometry, undimmed/non-modal flags, a real upward finger gesture,
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
