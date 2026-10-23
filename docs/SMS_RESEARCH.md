# SMS format research — preview 0.1.3

Research date: 20 October 2026. This registry describes selected INR alert formats,
not every message from a listed bank.

The new examples were researched in the original maintainer’s
[Cashiro parser tests](https://github.com/ritesh-kanwar/Cashiro/tree/40a387fd0bb87bdc51c80124e0fbf084e8a2b2ce/parser-core/src/test/kotlin/com/ritesh/parser/core/bank)
and bank-specific format comments at revision 40a387fd0bb87bdc51c80124e0fbf084e8a2b2ce.
These are community-maintained examples, not bank-issued template certification.
Each researched fixture has a pinned source in testdata/bank-sms-sources.json.
Amounts, names, account suffixes, references, dates and contact details are synthetic.
No real messages from a user’s phone are fetched for this research.

## Registry and tested message families

| Bank / issuer | Exact sender tokens | Positive synthetic cases | Tested methods |
| --- | --- | ---: | --- |
| HDFC Bank | HDFCBK, HDFCBN | 10 | BANK, CARD, UPI |
| ICICI Bank | ICICIB, ICICIT | 5 | BANK, CARD, UPI |
| SBI | SBIINB, SBIPSG, SBIBNK, SBIUPI, SBIYNO, ATMSBI | 4 | BANK, UPI |
| SBI Card | SBICRD | 1 | CARD |
| Axis Bank | AXISBK | 3 | BANK, CARD |
| Kotak Mahindra Bank | KOTAKB | 2 | BANK, UPI |
| IDFC FIRST Bank | IDFCBK, IDFCFB | 2 | BANK, CARD |
| Federal Bank | FEDBNK, FEDBK | 2 | CARD, UPI |
| Punjab National Bank | PNBSMS, PNBBNK | 2 | BANK, CARD |
| Canara Bank | CANBNK, CNRBNK | 2 | BANK, UPI |
| Union Bank of India | UNIONB, UBISMS | 1 | BANK |
| Bank of Baroda | BARBSM, BOBSMS, BOBTXN, BOBCRD | 1 | CARD |
| Bank of India | BOIIND, BOIBNK, BOISML | 1 | UPI |
| Indian Bank | INDBNK, INDBKS | 1 | BANK |
| IndusInd Bank | INDUSB | 2 | BANK, UPI |
| YES Bank | YESBNK, YESBK | 1 | CARD |
| HSBC | HSBCIN, HSBC | 2 | BANK, CARD |
| Standard Chartered | SCBANK | 1 | UPI |
| American Express | AMEXIN, AMEX | 1 | CARD |

BANK means the SMS does not identify a card or UPI method. Trace does not infer
PhonePe, Paytm or another payment app from a generic bank message.

## Parsing changes

- A shared sender registry generates the native mapping and is imported by the
  browser demo. Complete sender tokens are matched. INDBNK identifies Indian Bank;
  INDUSB identifies IndusInd. These must not be confused.
- Added Kotak source-account sends, Axis multiline card layouts, HSBC card-used
  layouts, ATM withdrawals and explicitly completed card-use/transaction wording.
- Outgoing debits may describe a beneficiary credit in tested ICICI, SBI,
  Bank of India and Standard Chartered layouts. Own-account credits stay excluded.
- A literal “Never share OTP/PIN/CVV” warning is distinguished from an actual OTP.
  Numeric OTP counterexamples still must be rejected.
- INR/Rs/₹ amounts must be tied to a debit/spend action. Precision and comma
  grouping are validated. Balances and credit limits cannot substitute for a
  missing transaction amount.
- Card-spend alerts use the card suffix and CARD method even if UPI is mentioned.

## Limits

Only the previously reported HDFC and ICICI formats have been confirmed by the
user on their Nothing Phone (2a). Other formats are research-backed and exercised
by regression/emulator tests; they still need real-bank physical-device feedback.

Foreign-currency spending is ignored rather than converting an INR credit limit
into a false purchase amount. Incoming credits, OTPs, failed/future payments and
bill reminders or card payment receipts do not count as purchases. An account
debit paying a card bill is not automatically reconciled with earlier card spends;
cross-account repayment/self-transfer reconciliation remains future work.

Coverage is limited to registered senders and tested layouts. Wording, sender
variants and languages can change. Unrecognised messages show a local receiver
outcome; raw rejected SMS is not retained or uploaded.
