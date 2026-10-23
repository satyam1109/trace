# Remarks, expense categories and optional location — 0.1.3 build 8

## Editing a saved payment

Open **Transactions** and tap a payment. **Remarks** sits immediately below
**Recipient** and accepts up to 500 characters, including line breaks. It starts
empty and is written only by the user. Choose **Save changes** to keep edits;
closing without saving leaves the stored fields unchanged. Remarks are included
in transaction search.

**Category** is now a dropdown with Expense (uncategorised), Food, Clothes,
Groceries, Travel, Bills & utilities, Health, Entertainment, Other and Lent money.
Selecting Lent money keeps the payment in the separate lending tab and total.
Expense categories are manual; saving a detected debit never requires choosing
one. Old records load as Expense with empty remarks. Recipient-only edits in the
native SMS popup preserve remarks and expense category.

## Enabling location on Nothing Phone (2a)

1. Install this APK as an update; do not uninstall Trace first.
2. Open **Privacy & settings → Payment location** and read the disclosure.
3. Tap **Enable location capture** and allow location. Approximate access works;
   precise access is optional.
4. For capture while Trace is closed, tap **Location permission settings**, then
   **Permissions → Location → Allow all the time**. On Android 11 and later,
   background access is enabled separately in system settings. Trace requests
   foreground access first and never bundles the background permission request.
5. Turn on the phone's Location setting. The settings card reports missing
   permissions or disabled phone location.
6. After the next supported debit SMS arrives, open the saved payment. A saved
   estimate shows coordinates, accuracy, fix time and whether it is approximate.
   **Open saved location in Maps** passes those coordinates to an external maps
   app only when tapped.

This is the phone's location **near SMS receipt**, not independently verified
payment location. A delayed SMS can arrive after the user leaves the payment
place. Historical payments are not backfilled with today's coordinates. Sample
payments and the browser demo never request a real device location.

## How capture works

- Location is off by default. SMS capture remains usable with location declined.
  The opt-in setting is written durably before the app acknowledges the change,
  including when the process stops immediately afterwards.
- The native receiver first saves the debit and attempts its normal popup or
  notification. Only a newly inserted live payment can request location; ignored
  and duplicate messages do not start a request.
- A bounded, one-shot Android LocationManager request tries enabled network,
  fused or GPS providers as permission allows. There is no continuous tracking,
  location foreground service, server or third-party location SDK.
- Cached fixes are accepted only when at most 30 seconds old. Current requests
  end after five seconds; stale, future and invalid-coordinate fixes are rejected.
  Android background throttling, indoor reception and battery restrictions can
  still make a fresh fix unavailable. The payment remains saved with a reason.
- Approximate permission retains coordinates rounded to two decimal places and
  an accuracy radius of at least 1,500 metres. Permission and opt-in are checked
  again before saving. Disabling future capture retains locations already saved
  in existing records; deleting a payment deletes its location too.
- Remarks, category and location are encrypted in the existing AES-GCM payload.
  The Room schema and encryption key are unchanged. A late callback cannot
  recreate a discarded record or overwrite remarks/category edits.
- Release permissions now include coarse, fine and background location alongside
  existing SMS/notification/overlay access. There is still no INTERNET, READ_SMS,
  SEND_SMS, contacts or accessibility permission.

Relevant platform sources:
[Android background location permission](https://developer.android.com/develop/sensors-and-location/location/permissions/background),
[current-location API and background limitations](https://developer.android.com/reference/androidx/core/location/LocationManagerCompat#getCurrentLocation(android.location.LocationManager,java.lang.String,android.os.CancellationSignal,java.util.concurrent.Executor,androidx.core.util.Consumer)).

## Verification

The browser suite covers manual remarks, dropdown choices, reload persistence,
cancelled edits, remark search, lending totals and the explicit sample-location
limitation. Native instrumentation covers old encrypted records, manual metadata
retention across process restart, validation and recipient-only popup edits.

After building and installing the app and its matching test APK on the isolated
`TraceMoneyMVP` AOSP emulator, run:

```sh
python3 scripts/verify-location-emulator.py
```

The script refuses physical devices. It tests denied permissions, precise and
approximate access using mock locations and synthetic telephony SMS, encrypted
persistence, stale-fix rejection, disabled phone location, opt-out during a
callback and discard safety. It also verifies a location-bearing SMS with the
app process absent, using a shell-owned mock provider. Results are written to `artifacts/location-check.json`
with the tested APK hash. Ordinary SMS replay is recorded separately in
`artifacts/sms-detection-check.json`. Real GPS/network acquisition on the user's
Nothing Phone still requires the on-device acceptance check above.
