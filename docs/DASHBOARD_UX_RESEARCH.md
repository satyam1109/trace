# Dashboard research for Trace

Research checked on **22 October 2026**. The combined reference board is
[dashboard-reference-board.png](../artifacts/dashboard-reference-board.png).
Its editable, linked HTML is in
[dashboard-reference-board.html](../artifacts/dashboard-research/dashboard-reference-board.html).

## Selection and evidence

These six established apps were selected for adoption, displayed ratings and
relevance to expense tracking. This is a design comparison, not a definitive
ranking, usability study or independently measured reliability comparison.
Ratings and download bands come from Google Play India listings and can change.
Screens are genuine publisher imagery, scaled to fit. Promotional screenshots
can show older designs; FinArt's website dashboard visibly uses an older example.
No accounts were created and no installed competitor app was independently tested.

| App | Google Play rating | Android download band | Image shown | Useful reference for Trace |
| --- | --- | --- | --- | --- |
| [Money Manager / Realbyte](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN) | 4.6 | 10M+ | Published category report | Category totals alongside a visual breakdown |
| [Wallet / BudgetBakers](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en_IN&gl=IN) | 4.6 | 10M+ | Published overview widgets | Separate cards for distinct financial questions |
| [Money Lover / Finsify](https://play.google.com/store/apps/details?id=com.bookmark.money&hl=en_IN&gl=IN) | 4.1 | 5M+ | Published income/spending overview | Clear hierarchy between period totals and category detail |
| [Spendee](https://play.google.com/store/apps/details?id=com.cleevio.spendee&hl=en_IN&gl=IN) | 4.0 | 1M+ | Published category overview | Charts paired with readable category rows |
| [YNAB](https://play.google.com/store/apps/details?id=com.youneedabudget.evergreen.app&hl=en_IN&gl=IN) | 4.6 | 1M+ | Published spending plan | Visible budget progress and remaining amounts |
| [FinArt](https://play.google.com/store/apps/details?id=com.finart&hl=en_IN&gl=IN) | 4.3 | 1M+ | [Official website home dashboard](https://finart.app/) | SMS automation connected to spending summaries |

The original image URLs, store URLs, selected screenshots and annotations are
preserved in [sources.json](../artifacts/dashboard-research/sources.json).
Five selected images are from Google Play; FinArt's home image is from its own
website. The source images and brands belong to their respective owners and are
research references, not assets for Trace's production interface. The board was
rendered from HTML, preserving the published interfaces rather than generating
approximations. Rebuild it with `node scripts/build-dashboard-reference.cjs`.

## What Trace already has

Build 11 captures supported debit SMS before showing a compact optional editor.
It includes manual cash entry, remarks, expense categories, a lending list,
optional receipt-time location, recent transactions and a seven-day spending chart.
These are a stronger starting point than adding another required input form.

The current Overview includes **all outgoing payments, including loans**, in its
spending total. Lending currently records amounts expected back, with no repayment
or partial-payment state. The next dashboard should make those meanings explicit.

## Recommended next features

1. **Separate spending from money lent.** Show recorded personal expenses and
   outstanding lending as separate amounts. Keep an optional total-outgoing view
   for reconciliation. Add user-confirmed classifications for self-transfers and
   credit-card bill repayments so buying on a card and later paying its bill are
   not both counted as consumption. Uncertain SMS should remain reviewable.
2. **Track lending repayments.** Add an optional due date, partial repayment and
   Mark as returned. Outstanding principal is original lending minus confirmed
   repayments. Preserve the original debit and a repayment history; repayments
   are not another expense. Start with manual confirmation because Trace's
   present receiver intentionally ignores incoming credit SMS. Never infer that
   a person repaid merely because any matching amount arrives.
3. **Add monthly and category budgets.** Let users choose an overall monthly limit
   and optional category limits. Show spent, remaining or over-budget amounts,
   and tap a category to see its transactions. Uncategorised expenses still count
   toward the overall limit. Label this **budget remaining**, not bank balance or
   guaranteed money available. SMS capture alone cannot establish a complete bank
   balance or all future commitments.
4. **Add an optional review queue.** Surface uncategorised expenses with a small
   count and quick category actions. Offer an explicit “Remember this merchant”
   rule after a user classifies a recognisable merchant. Keep uncertain or
   multipurpose UPI recipients uncategorised. Do not require the payment popup
   to be completed or use an unverified category as a certainty.
5. **Add useful reports and dependable portability.** Compare spending with the
   same period in the previous month, with category drill-down and CSV export.
   Explain when history is incomplete. Add encrypted backup/restore and optional
   app lock before family/cloud sharing. A portable backup needs deliberate key
   handling; copying a Keystore-encrypted database alone is not a cross-device
   restore solution.
6. **Later: confirmed recurring payments and bill reminders.** Suggest patterns
   for user confirmation, allow due-date corrections and distinguish a bill notice
   from an actual debit. Local reminders should be optional. Receipt capture,
   family sharing and external integrations can follow after these core flows.

## Proposed dashboard order

- Header: selected month, hide amounts and a small detection-status indicator.
- Main card: recorded personal spending for the period, with prior-period context.
- Two secondary cards: budget remaining and money still owed to the user.
- Small action row: uncategorised items needing optional review.
- Category breakdown: four or five horizontal bars with amounts and a View all link.
- One trend chart with a consistent date range, followed by recent activity.

Keep **Overview / Transactions / + Create / Lent / Privacy**. Reports can live
inside Overview rather than adding a sixth bottom tab. Keep gold for the main
amount/action and use the existing navy palette. Reserve glass for small overlays
and navigation surfaces; readable charts and amounts benefit from solid cards.
Move long marketing/demo explanations away from the live dashboard; show them in
onboarding or the existing sample workspace. A detection indicator should report
actual permission/receiver status, never an unsupported “100% captured” claim.

## Suggested implementation sequence and acceptance

First fix spending/lending semantics and add partial repayments, then build the
new dashboard and budgets on those totals. Add merchant rules and review actions
next. Keep capture and popup timing independent of these optional features.

Checks should cover exact paise, sample/live separation, old-record defaults,
partial repayment limits, no duplicate original debit, category/overall budget
math, transfer/card-repayment exclusion, persistence after process restart and
consistent reporting periods. New UI should handle empty history, no configured
budget, long recipient names, large fonts and hidden amounts. Update in place so
existing records and encryption keys remain usable.

This research pass adds the reference board and recommendations. It does not
change Trace's application code, permissions, stored transactions or APK.
