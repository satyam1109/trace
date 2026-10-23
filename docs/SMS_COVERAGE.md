# SMS coverage and reliability

The current preview supports selected message formats, not every message from a
supported bank. A bank name in the sender registry is not proof that every one of
that bank's UPI, card, ATM, transfer, mandate, fee or regional-language templates
is understood. Synthetic tests cannot establish real-world coverage percentages.

## Current evidence

| Bank | Tested format families | Physical-device evidence |
| --- | --- | --- |
| ICICI | Selected debit and card-spend forms; debit followed by a semicolon-delimited credited beneficiary; `UPI:` reference | User confirmed the corrected ICICI format works on Phone (2a) |
| HDFC | Card spends with `*` in merchant names, including the reported `Spent Rs… On HDFC Bank Card… At…` format; selected explicit debited/spent forms; `Sent Rs… From HDFC Bank A/C… To…`, including line breaks and a following balance | User confirmed the corrected HDFC format works on Phone (2a) |
| Other registered banks / issuers | Selected debit, ATM, transfer and card-spend layouts; see the research matrix | Synthetic regression and cold-start emulator replay only |

Preview 0.1.3 registers 19 banks/issuers and 40 exact sender tokens. The registry
includes SBI, SBI Card, Axis, Kotak, IDFC FIRST, Federal, PNB, Canara, Union Bank,
Bank of Baroda, Bank of India, Indian Bank, IndusInd, YES Bank, HSBC, Standard
Chartered and American Express alongside HDFC and ICICI. It accepts selected INR
formats only. [Research sources and the per-bank matrix](SMS_RESEARCH.md) identify
the tested layouts; a registered issuer does not imply every card or debit alert
is supported. Foreign-currency spends and bill reminders are ignored. Card bill
repayments are not reconciled with original purchases.

## Shared regression corpus

`testdata/bank-sms.tsv` contains synthetic fixtures with expected amount, bank,
masked account suffix, payment method, recipient and reference, or an expected
ignore result. It is exercised by both the production Kotlin parser's JVM tests
and the separate browser demonstration parser's tests. This prevents a test
example from passing only in the web demo while failing in the native parser.

The corpus has 170 cases: 46 positive cases across the 19 registered
banks/issuers and 124 negative cases. Existing focused parser regressions remain too.
These are engineered cases, not a representative collection of all bank traffic.
No claim of universal bank coverage or measured production accuracy follows from
their passing.

```sh
npm test -- --runInBand
cd android
./gradlew :app:testDebugUnitTest -PreactNativeArchitectures=arm64-v8a
```

The version 0.1.3 build 5 APK also passed the telephony replay with
`python3 scripts/verify-sms-emulator.py --researched-corpus`: all 28 researched
positive examples were captured with the app process absent, and 98 researched
counterexamples created no expenses. Together with the existing smoke cases,
141 injected SMS reached the receiver. The exact APK hash and results are in
`artifacts/sms-multibank-build5-check.json`. Build 9 repeats the expanded replay and original HDFC card example (142 injected
messages); its current results are recorded separately in `artifacts/sms-detection-check.json`. These are synthetic emulator messages;
only HDFC and ICICI have user-confirmed physical-device examples so far.

## Required workflow for a newly reported format

1. Confirm that an actual SMS arrived and inspect Trace's receiver status. A
   missing popup, no SMS broadcast, paused detection and parser rejection are
   different failures.
2. Obtain a complete redacted example, including sender ID and boilerplate after
   the amount. Replace personal account, merchant, reference and balance values
   with synthetic values before adding it to the repository.
3. Add an expected-output fixture before changing the parser. Include nearby
   negative cases such as a credit to the user, failed transfer, refund, OTP,
   available balance, future debit and an unrelated sender.
4. Add or extend the particular bank/format rule with shared amount and reference
   validation. Run the entire cross-bank corpus, including the ICICI regression,
   so an HDFC fix cannot quietly break those existing cases.
5. Replay the new format through Android telephony with the app process absent.
   Verify retention, notification/popup behaviour and reference deduplication.
6. Install the resulting APK and verify a newly arriving real message on a
   physical device. Record the tested bank, template family and app version.

## Work still needed before broad public coverage

- Collect a larger consented, anonymised corpus across banks, channels, sender
  variants, language, punctuation, line breaks and multiple amounts. Separate
  development examples from held-out validation examples.
- Track false expenses and missed debits per bank and template family. A high
  overall score can conceal a completely unsupported bank.
- Give users a clear, optional review/report path for unrecognised bank formats.
  Currently only local receiver outcome metadata is retained; raw rejected SMS
  messages are not stored for later review or automatically uploaded.
- Automate the regression and device checks in release checks, expand physical
  device/OS coverage, and distribute reviewed, versioned parser updates.

SMS may arrive late or not arrive. This preview cannot recover earlier missed
messages because it does not read inbox history. Unknown formats remain unknown
rather than using a balance or OTP as a guessed payment amount. Even with broader
coverage, SMS capture remains a derived record, not independently verified bank
settlement data.

## Card check in build 9

The shared corpus has 16 positive card-spend cases across 11 issuers, with
expected amount, masked suffix, method, merchant and reference checked in both
parsers. These include the supplied HDFC example and a clean numeric-suffix
variant, plus adjacent failure, OTP, refund, bill-due and personal-sender cases.
`Spent Rs.787.34 On HDFC Bank Card 6789b At NJ*bhbjhb POT BHJHBHJ On 87879`
records ₹787.34, CARD and the full asterisk merchant. The anonymised `6789b`
suffix is left blank; `6789` is retained in the numeric variant. An invalid or
unparsed date is not guessed: the record keeps SMS receipt time.

The emulator replay also injects the original example through Android telephony,
with the app process absent, to exercise receiver delivery, persistence and popup.
A sender ID must still match a registered token. Unsupported/new templates,
non-INR spends, absent bank SMS, revoked permissions and force-stop states can
still prevent capture. Card bill repayments are not automatically reconciled
with purchases and may double-count spending if both debit messages are saved.
