# Manual expenses — 0.1.3 build 9

The bottom navigation now reads **Overview · Transactions · + Create · Lent money · Privacy**.
Create is an action that opens a form; the four existing destinations remain.
The desktop sidebar exposes the same action.

Tap Create, enter an INR amount and choose Cash (default), UPI, Card or Bank.
Recipient and remarks are optional. Select an expense category or Lent money,
then set the payment date and local time and tap Save expense. Date defaults to
today and time defaults to the current minute. The fields use YYYY-MM-DD and
24-hour HH:mm. Invalid dates, future times, non-positive amounts and more than
two decimal places are rejected. Supported dates start in 2000. Amounts are
stored as integer paise, with the same ₹10 crore limit as the SMS parser.

Manual entries save immediately to encrypted local storage without a popup
countdown. No SMS, notification, overlay or location permission is needed.
The form guards repeated Save taps. Cancel creates no entry. Native code
independently validates the input before any database write. Existing records,
Room schema, encryption key and SMS reception are preserved during an update.

Manual records have source=manual, an empty bank reference/account suffix, and
a chosen payment timestamp separate from creation time. History order, date
labels, monthly/week totals, method breakdown and chart use that payment time.
Cash has its own history filter and overview card. Lent manual entries join the
existing all-time Lent money list and total. Remarks, category edits and discard
confirmation work as for detected entries. Manual location stays empty: a phone
location recorded now would not establish where a past cash payment happened.

On Android, Live and Sample workspaces remain separate. On the browser demo all
manual entries are sample data in unencrypted localStorage; use synthetic data.
Manual entries are not automatically reconciled with later SMS: check history
before adding a missed payment and discard any duplicate deliberately. This
version also does not reconcile card-bill repayments with card purchases.

## Verification

- Shared validation tests cover exact paise, amount boundaries, invalid dates,
  future timestamps, methods and categories.
- Browser interaction tests cover the mobile centre action, cash entry, past
  payment time, categories/remarks, reload, filtering, cancelled/invalid input,
  repeated Save taps and manual lending.
- `scripts/verify-details-emulator.py` refuses every device except the synthetic
  TraceMoneyMVP AVD. It tests native validation, encryption, persistence after
  process restart and the actual release React Native form/TurboModule with
  RECEIVE_SMS permission revoked. It also reruns metadata/lending and native
  discard checks. Results: `artifacts/manual-entry-check.json`.
- [Card coverage and limitations](SMS_COVERAGE.md) describe selected formats and
  the provided HDFC sample; fixtures cannot establish a production success rate.
