# Lent money — preview 0.1.3, build 8

After a payment is saved, open **Transactions**, tap the payment and choose
**Lent money** in the **Category** dropdown. You can also edit the recipient to name the
person who will return it. Tap **Save changes**.

The fourth navigation tab, **Lent money**, shows the total amount marked as lent
at the top and those transactions underneath, newest first. The total includes
all dates in the current workspace. Sample and live payments remain separate.
Search and payment-method filters in Transactions do not hide entries in this tab.
The hide-amounts control also applies to the lending total and rows.

A lending entry is still the original saved payment in Transactions; it is not a
second debit. Tap an entry to edit it. Switching its category back to **Expense**
removes it from the lending list and total while retaining the payment in history.
Discarding a transaction first asks for confirmation. **Keep entry** retains the
record and any unsaved recipient/category edits. **Discard entry** deletes that
record from both views. Closing the editor
without saving leaves its category unchanged.

This feature records the user's expectation that money will be returned. It does
not detect repayments, calculate interest, set due dates or reconcile incoming
credits. Overview still totals all recorded outgoing payments, including loans.

## Existing data and privacy

The category is part of the AES-GCM-encrypted native transaction payload. The Room
schema and encryption key stay the same. Older records without a category read
as Expense; a category is persisted when edited. A recipient-only edit in the
native SMS popup preserves the saved category. New captures default to Expense.
No permissions or network services were added. The browser remains a sample-data
demo using unencrypted localStorage and defaults old demo records to Expense.

Update with `adb install --no-streaming -r artifacts/trace-android-preview.apk`.
Do not uninstall first: an update preserves the app's records and encryption key.

## Verification

`npm run test:web` covers categorising existing records, exact totals, all-date
coverage, unrelated search/filter state, reload persistence, changing a category
back, deleting a lent entry, cancelling edits, hiding amounts and the four-tab
layout at a 360-pixel phone width. The suite has thirteen tests including existing
payment-capture UI regressions, discard confirmation and full-width mobile details.

The dependency-free test APK runner checks the production Android repository on
an emulator. It creates only synthetic records, reads an encrypted payload without
a category, saves lending categories for sample/live records, checks encryption
and exact paise, rejects an invalid category, verifies a recipient-only edit, then
checks persistence in a fresh process and deletes only its own records.

```sh
# Build with the installed Android Studio JVM selected by this checkout:
cd android
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:testDebugUnitTest :app:assembleRelease :app:assembleDebugAndroidTest -PreactNativeArchitectures=arm64-v8a
cd ..
# Use the isolated TraceMoneyMVP emulator, never a physical phone for these tests:
adb -s emulator-5580 install --no-streaming -r artifacts/trace-android-preview.apk
adb -s emulator-5580 install --no-streaming -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5580 shell am instrument -w -e phase prepare com.tracemymoney.test/com.tracemymoney.ledger.LendingVerification
adb -s emulator-5580 shell am force-stop com.tracemymoney
adb -s emulator-5580 shell am instrument -w -e phase verify com.tracemymoney.test/com.tracemymoney.ledger.LendingVerification
adb -s emulator-5580 shell am instrument -w -e phase discard com.tracemymoney.test/com.tracemymoney.ledger.LendingVerification
```

All phases must report `result=PASS`. The discard phase tests the real native SMS
popup: confirmation before deletion, paused timeout, Keep entry, Android Back and
confirmed removal. The runner is included only in the separate
test APK, not the delivered app. See `artifacts/lending-check.json` for the tested
APK hash and checks. SMS receiver regression results for the same APK are in
`artifacts/sms-detection-check.json`; the earlier build's replay is preserved in
`artifacts/sms-multibank-build5-check.json`. The additional UI checks are in
`artifacts/ui-check.json`.
