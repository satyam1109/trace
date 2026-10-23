# Trace / TraceMyMoney

An Android-first, offline money tracker with automatic bank-debit SMS capture, manual expense/income entries, budgets, savings goals and lending. The React Native UI also runs as an explicitly labelled browser demonstration.

Current preview: **0.2.0 / build 12**. Verified with 204 JavaScript unit tests, 191 native parser tests, 15 browser flows and emulator checks for database migration, finance editors, SMS capture, popup motion/timing and location. The 1→2 database upgrade preserved all 213 existing encrypted synthetic records. The Home screen is graph-free; spending charts live in Analytics. See [the UX v2 implementation notes](docs/ux/UX_V2_IMPLEMENTATION.md).

## Run the browser demo

```sh
npm install
npm run web
```

Open http://127.0.0.1:5173. The browser cannot receive SMS or show system overlays. It uses synthetic transactions stored in browser localStorage, which is **not encrypted**. Do not paste actual SMS or OTPs into the simulator. Sample data can be reset in Settings → Data & storage. The design-only mockups on port 5174 are separate from the implemented app on port 5173.

## Run on Android

Requirements: Node 24.3+ (or a compatible version in package.json), JDK 21, Android Studio / Android SDK, Build Tools 37, Android platform 37, and a connected Android device or ARM64 emulator. The Gradle wrapper is included. Set ANDROID_HOME to your local Android SDK directory, or set sdk.dir in android/local.properties (not committed).

```sh
npm install
npm start -- --host 127.0.0.1
# In another terminal, with a device connected:
npm run android
```

The Android launcher selects an installed JDK 21 on macOS without editing shell settings. Gradle daemon JVM criteria, if configured by Android Studio, take precedence. This checkout currently selects JDK 25; the installed Android Studio runtime satisfies it at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`. Set JAVA_HOME to that path for local Gradle commands to avoid downloading another runtime. Use a compatible JAVA_HOME on other operating systems. Open the app at least once. Go to **Settings → Payment detection → Automatically capture payments**, read the incoming-SMS disclosure, and explicitly grant SMS access. Notifications and floating prompts are separate permissions. Detection starts disabled. A force-stopped app or revoked permission can interrupt delivery.

No READ_SMS permission is requested: this initial version only receives future incoming SMS, not historical inbox contents. No SEND_SMS, contacts, accessibility or banking credentials are requested. Location permissions are optional and requested separately when the user enables receipt-time location capture.

For a standalone local preview build, including the JavaScript bundle:

```sh
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The current release variant is signed with the template **debug key for local testing**. It is not a production signing configuration or a Play Store release. The debug build requires Metro and has INTERNET permission for development. The release manifest does not request INTERNET.

## Included

- Five-tab navigation: Home / History / + Add / Analytics / Settings. Clear **Manage budgets** and **Savings goals** shortcuts on Home.
- Graph-free Home with recorded expenses, income, monthly surplus, budget remaining, category summaries and recent entries. Missing income is shown as not recorded.
- Manual expense/income/lending/transfer entries, editable amount/date/time/method/category/remarks, history search, date/category/type/method filters and date/amount sorting.
- Built-in expense and income categories, custom expense categories, explicit cash/UPI/debit-card/credit-card/bank labels. Older generic card alerts stay unspecified.
- Monthly overall/category budgets, optional future-month defaults, historical budgets, utilisation and overspending states.
- Local budget notifications at 70%, 90% and 100%, threshold deduplication, overall limit alerts, and configurable in-app warnings.
- Daily/weekly/monthly spending, category distribution, cash flow, budget vs actual, matching-date month comparisons, date-range filtering and transaction drill-down. Charts use recorded data.
- Monthly savings targets, goals, contributions and contribution/savings history. Allocations do not create another expense.
- Lending outstanding/returned views, partial/full repayments and deletion safeguards. Repayments are separate from income.
- Light / Dark / System themes, local profile, four currencies with separate totals (no currency conversion), and Android biometric/device-credential app lock.
- Native Android date/time pickers, receipt-time optional location and actual SMS receiver diagnostics.
- Native SMS_RECEIVED BroadcastReceiver protected by BROADCAST_SMS.
- Kotlin templates for selected INR debit and card-spend formats across 19 bank/issuer profiles and 40 exact sender tokens, generated from a shared registry.
- Integer-paise amount parsing; missing debit amounts do not fall back to balances.
- Room/SQLite schema 2 with AES-GCM-encrypted transaction and planning payloads, Android Keystore keys, and a non-destructive schema-1 upgrade migration.
- Native payment dialog and privacy-preserving notification fallback.
- Confirmation before discarding an individual payment, including from the native SMS popup. Mobile transaction editing fills the screen width with internal content padding.
- Persist-first behaviour: a transaction is written before a prompt is attempted. Ignoring or dismissing the prompt retains it. The five-second countdown closes the UI; editing resets it to ten seconds from the latest interaction. Swipe up or tap the compact summary to reveal optional remarks/category and Save; saving does not depend on a background timer.
- Separate real and sample workspaces, explicit permission status, pause detection and delete controls.

The native module owns the database. React Native calls it through a code-generated TurboModule. Real SMS capture, parsing and persistence do not require the React Native runtime to be active. The browser parser is a separate demonstration implementation and is never used for actual SMS capture.

## Privacy and limitations

Android SMS access is broad. There is no operating-system permission for bank messages only. The native parser filters supported senders and message templates, ignores OTP/credit/failure/refund messages, and does not persist raw message bodies. Bank sender recognition is not cryptographic proof of a payment.

Financial fields are encrypted before Room writes them. Row IDs, sample flags and receipt timestamps are database metadata. Backup and device-transfer exclusions are configured. There are no analytics SDKs or cloud services. Native payment-dialog screenshots are blocked, and notifications contain no amount or recipient.

This is an initial prototype, not independently security audited. The template development dependencies currently report upstream npm audit findings, including unpatched braces/sprintf-js issues. Review dependencies, signing, device behaviour, retention and security before any public release. Google Play restricted-SMS and background-location declaration/review, privacy policy and consent requirements still apply.

Supported templates are deliberately limited, not universal bank coverage. Unsupported messages are ignored. Reversals/refunds are ignored rather than reconciled. Reference-bearing messages deduplicate using bank, account, reference and amount. Without a reference, only matching messages in a one-minute receipt bucket deduplicate; cross-bucket duplicates can remain, and identical legitimate reference-less messages within one minute can be merged. This heuristic needs broader real-message testing. Sample events intentionally create separate entries so the simulator is repeatable.

The UI shows SMS receipt time; original bank transaction time remains unknown. Payment app names (PhonePe/Paytm/etc.) are not inferred from generic UPI messages. Location is off by default. If enabled with the required Android permissions, a newly received debit can attach a fresh device estimate near SMS receipt. Delayed SMS can arrive after the user leaves the payment place; old records are not backfilled. Card spending and account debits are recorded as reported; account-to-account transfers and credit-card repayments are not automatically reconciled against spending.

Floating prompts depend on the special display-over-other-apps permission and Android background-activity rules. The screen is not forced on while locked; a private notification is used when available. The saved transaction remains accessible even if the operating system blocks the popup. Exact display timing is not guaranteed.

The iOS template is retained as scaffolding only. SMS automation and native ledger integration are implemented on Android. The browser preview is for interaction testing, not financial data collection.

## Verify

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
npm run web:build
npm run test:web
# Android parser tests and debug APK:
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Playwright uses a locally installed Google Chrome in headless mode with an isolated profile. Browser tests cover automatic retention, timeout, reload persistence, editing, filtering, discarding, OTP/failure rejection, data deletion and a mobile viewport. Kotlin JVM tests exercise the actual native bank parser. Receiving bank SMS, permission behaviour and prompts should also be validated on physical Android devices.

Key files: App.tsx and src/ui/ (current UI), src/finance/model.ts (calculations and planning), src/native/NativeMoneyLedger.ts (TurboModule contract), src/services/ledger.ts (Android interface), src/services/ledger.web.ts (browser demo), android/app/src/main/java/com/tracemymoney/ledger (native implementation).

## Historical runtime verification

The following paragraphs describe earlier 0.1.x builds. Current build-12 evidence is recorded in `artifacts/ux-v2`, with the latest SMS and popup reports in `artifacts/`.

Verified on 19 October 2026 using a standalone ARM64 APK on an isolated Android 16 / API 36 emulator, with synthetic SMS only. The emulator completed the real permission flow. A debit SMS showed the native popup and retained the payment without input. Repeating that reference, sending an OTP and sending a failed-payment alert left one recorded payment. After the app process was killed, a second card SMS cold-started the native flow; editing and saving its recipient survived an encrypted database readback in the React Native transaction list. Bottom navigation was checked on the actual Android screen.

For preview 0.1.3, the checks comprise 19 focused native parser tests, 2 native registry tests, 12 focused browser-parser tests, 170 shared corpus cases exercised in both parsers, 20 browser interaction tests and 15 manual-validation unit tests, a successful release Android build, APK signature/checksum verification, and emulator replay. Native instrumentation also verifies legacy metadata defaults, remarks/category persistence across process restart, discard confirmation and optional location with synthetic fixes and SMS. The release requests RECEIVE_SMS, POST_NOTIFICATIONS, SYSTEM_ALERT_WINDOW and optional coarse/fine/background location permissions, plus an AndroidX-generated internal signature permission. INTERNET, READ_SMS, SEND_SMS, contacts and accessibility permissions are absent.

Local deliverables: artifacts/trace-android-preview.apk (debug-signed preview 0.1.3 for ARM64 Android), artifacts/SHA256SUMS, artifacts/sms-detection-check.json and artifacts/bank-coverage.json. Earlier runtime reports/screenshots remain in artifacts/ as historical checks. The browser demo is independent of the native test device. The user confirmed the reported HDFC and ICICI formats on Phone (2a); the additional formats still require physical-device feedback. Public release preparation remains outstanding.

For installation, permissions and a real-SMS acceptance check on a Nothing Phone
(2a), see [the phone setup guide](docs/NOTHING_PHONE_2A.md).

The repeatable telephony replay is `python3 scripts/verify-sms-emulator.py` against
the configured synthetic-only `TraceMoneyMVP` AOSP emulator. It checks the installed
APK's hash, cold-process SMS delivery, popup timeout, live persistence, ignored
messages, multipart reconstruction and notification fallback. It refuses physical
devices. Results are written to `artifacts/sms-detection-check.json`.

Preview 0.1.1 fixes the reported ICICI `AX-ICICIT-S` template containing both
`Acct XX123 debited ...; Example Person credited. UPI: ...`. The old global credit
filter incorrectly discarded these debits. The proven ICICI beneficiary clause
is now handled separately from own-account credits; short masked account suffixes
and colon-prefixed UPI references are extracted. Regression fixtures use synthetic
account, beneficiary and reference values. A local receiver-status panel records
only a count, receipt timestamp and fixed outcome code, never message contents.

Cross-bank regression fixtures now live in `testdata/bank-sms.tsv`; the same 170
synthetic cases exercise Kotlin and the browser parser. These supplement the
focused tests and do not imply universal bank coverage. See
[SMS coverage and reliability](docs/SMS_COVERAGE.md) for the evidence by bank,
the HDFC regression and the workflow required for each new format.

Preview 0.1.2 adds the reported HDFC `CP-HDFCBN-S` format beginning `Sent Rs…
From HDFC Bank A/C… To…`. This is an HDFC-specific source-account template;
arbitrary uses of “sent” do not become expenses. Shared fixtures cover the full
redacted format, line breaks, adjacent amount/source wording, a following balance
and failure/OTP/future/wrong-source exclusions. The telephony replay verifies its
native popup, retention and reference deduplication alongside the ICICI fix.

Preview 0.1.3 adds researched examples across 19 bank/issuer profiles, including
credit-card purchase alerts, multiline card messages, ATM withdrawals and
beneficiary-credit clauses. It preserves the HDFC and ICICI regressions. See
[the research matrix and pinned sources](docs/SMS_RESEARCH.md) for exact coverage.
The shared corpus contains 44 accepted examples and 119 rejection cases.

On 20 October 2026, the build 5 APK with `python3 scripts/verify-sms-emulator.py --researched-corpus`
replayed 28 researched positive examples with cold app processes and 98 negative
examples in addition to the existing smoke flow. All 141 incoming synthetic SMS
were accounted for; only the expected 34 live records were added. Popup timeout,
encrypted retention, multipart SMS, duplicate prevention and notification fallback
also passed. This verifies the tested receiver path, not universal bank coverage.

The updated 0.1.3 preview uses Android versionCode 11, so it can be installed over
earlier 0.1.3 builds without deleting records. Build 5 introduced lending; build 6
adds discard confirmation and full-width mobile details; build 7 applies the
navy-and-gold theme across the app, browser preview and native popup. Build 8 adds
manual remarks, the expense dropdown and optional receipt-time location. See
[details and location](docs/DETAILS_AND_LOCATION.md),
[Lent money](docs/LENT_MONEY.md) for the category flow and
[UI direction](docs/UI_DIRECTION.md) for the implemented UI changes and proposed
next design pass. The current APK's SMS smoke is in
`artifacts/sms-detection-check.json`; the earlier expanded bank replay is preserved
in `artifacts/sms-multibank-build5-check.json`.

Build 9 adds the centre Create action, encrypted manual expense storage and Cash
filters/totals. Chosen payment time drives history order and reporting for manual
entries, while SMS entries keep receipt time. The HDFC card-spend regression now
handles asterisks in merchant names and leaves malformed anonymised card suffixes
blank. The 170-case shared corpus includes 16 positive card examples across 11
issuers; this is format regression evidence, not a measured real-world capture rate.
The release Android form is exercised through its actual TurboModule with SMS
permission denied; see `artifacts/manual-entry-check.json`.

Build 10 adds optional Remarks and Category directly to the detected-payment
popup. Untouched popups close after five seconds; interaction resets a ten-second
idle window and Save commits immediately. Category/discard dialogs pause the
countdown. The native popup persists edited drafts in encrypted local storage
and retains changes on Back/dismiss. The original payment remains saved even
when no metadata is entered. See [popup behaviour and verification](docs/PAYMENT_POPUP.md).

Build 11 replaces the centred form with a compact, animated bottom card. Swipe up
or tap to reveal optional remarks/category and Save; swipe down to collapse. The
compact state leaves the screen undimmed and can be dismissed immediately while
keeping the payment. Android supports a glass-style surface with native blur and
an opaque fallback. The five/ten-second save behaviour remains in place. See
[popup behaviour and verification](docs/PAYMENT_POPUP.md).
