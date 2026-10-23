# Trace UX blueprint — design proposal

Status: UX implemented in Android preview 0.2.0 / build 12. The Figma canvas remains empty because of the MCP tool limit. See UX_V2_IMPLEMENTATION.md for delivered behaviour and verification.
This draft covers the user's expanded feature requirements while preserving
Trace's SMS capture, compact payment popup and lending capability. The local design screen set is a reference; the implementation keeps Home graph-free.

## Product direction

Trace should make a recorded month understandable, then make the next useful
action easy. Its identity comes from an expressive spending overview, concise
explanations backed by recorded transactions, connected drill-down and restrained
motion. All core insights can be computed locally. An AI service is not required.

Keep the navy/gold identity. Use warm, quiet light surfaces and deep navy in dark
mode, consistent category colours, generous spacing and legible tabular numerals.
Use glass for the navigation dock, compact payment overlay and sheets. Financial
content should retain enough surface opacity for clear text and chart labels.
Use accessible text labels alongside colour and icons.

## Financial vocabulary — selected design direction

The design uses **Budget left** as the remaining amount. This is a budget metric, not an actual live bank balance. Payment methods remain labels in this MVP. The monthly surplus is shown separately as Saved this month.

| Display | Meaning |
| --- | --- |
| Spent this month | Recorded consumption expenses for the selected month, excluding lending, own transfers and card-bill repayments already represented by card purchases |
| Income this month | Recorded income for the selected month; start with manual income entry rather than treating every incoming credit as income |
| Saved this month | User-requested calculation: recorded income minus recorded consumption expenses. Explain that it is the month's surplus, not a verified savings-account balance |
| Budget left | Selected month's overall budget minus its expenses; show an explicit over-budget amount when negative |
| Money owed to you | Outstanding lending principal after confirmed repayments; separate from income and consumption expenses |
| Goal progress | Money the user has explicitly allocated to that goal; distinct from monthly surplus |

Example data, for design only: income ₹60,000, expenses ₹18,450, overall budget
₹30,000, budget left ₹11,550, budget used 61.5%, monthly surplus ₹41,550 and
outstanding lending ₹2,500. These are examples, not the user's financial records.

When income has not been entered, label it as not recorded and do not present a
confident savings calculation. An explicitly confirmed zero-income month is
different from missing income data. A negative monthly surplus should be shown
as a deficit rather than silently clamped to zero. Loans returned are not fresh salary/income. Moving money into a
savings goal is not a second expense. Credit-card purchases and subsequent bill
payments must not both inflate spending. Ambiguous transactions stay reviewable.

## Navigation and connected journeys

Use **Home / History / + Add / Analytics / Settings**. Add is a persistent action
that opens a composer, not an empty destination. Return to the previous screen
when it closes. Budget, savings and lending live one tap from Home and remain
reachable through appropriate History filters and contextual links.

A selected month provides context for Home, budgets and linked analytics. Tapping
any amount or chart opens the corresponding filtered records. Back restores the
previous period, scroll position and filters. The month control also supports a
month/year picker so users are not forced to swipe through years of history.

### Home

1. Compact header: Trace, month selector, hide amounts and detection status.
2. Hero: **Spent this month**, with same-period comparison only when enough
   comparable history exists. Its subtle background spending trace is interactive,
   not another competing full chart.
3. Compact summary area: Income, Saved this month and Budget left.
   All user-requested totals remain available without equal-sized competing cards.
4. Overall budget: spent/limit, true utilization percentage and remaining/over amount.
5. One actionable insight, with a link to its underlying records. Examples:
   “Food is your largest category at 35%” or “Spending is 14% above the same dates
   last month.” Show the comparison dates in details. Do not fabricate insights
   when history is sparse or categories are unknown.
6. Category summary: top categories with consistent colours and amounts; tapping
   a category opens its breakdown and transactions.
7. Compact entry points: savings goal progress and money owed to the user.
8. Recent activity: five transactions, grouped by date, with a View all link.

Budget and savings setup are optional, compact calls to action until configured.
Do not show zero-budget progress or fake comparisons as if setup were complete.
A first-use empty dashboard should help the user enable capture or add an entry.
Keep sample/demo financial data visibly separate from the user's live history.

### Add, History and transaction details

The Add composer starts with Expense / Income, a large amount and numeric keypad.
Keep Category and payment method nearby; date/time defaults to now. Notes,
recipient and further details are optional and expand without losing the draft.
Income defaults to a sensible income category such as Salary, Freelance or Other.
New custom categories allow a name, icon and colour, and appear consistently in
forms, history, budgets and charts.

History uses date-grouped rows with recipient/source, amount, category and method.
Keep search visible. A filter sheet provides date range, category, type and method;
sort offers newest, oldest, highest and lowest amount. Applied filters are visible
and removable, and an empty result offers Clear filters. Transaction details is
full width, supports editing, and retains the existing delete confirmation.

Payment methods include Cash, UPI, Debit card and Credit card as requested. Keep
Bank transfer and an unspecified Card label for existing or ambiguous records;
never guess debit versus credit when the SMS does not establish it. Methods do
not represent a bank connection or guarantee an account balance.

### Budget management and alerts

Budget overview shows overall progress, category rows, utilization, remaining
amounts, and explicit at-limit/over-limit states. Each row opens details and
filtered transactions. Add/edit budgets directly; default monthly values may
seed the next month without rewriting historical budgets or transactions.

Monthly reset means a fresh month of usage against that month's budget, not
clearing old records. Previous months remain visible and editable with the period
clearly labelled. A missing category budget is different from a zero budget.

Support 70%, 90% and 100% category thresholds and an exceeded-overall-budget alert.
Use quiet inline guidance at 70%, stronger warning at 90%, and explicit at-limit
or over-budget labels at 100% or above. Display actual percentages above 100 even
if the visual track is full. Notifications are local, optional and configurable.
Notify once per budget/month/threshold; a large expense crossing several thresholds
should produce the most relevant single warning instead of three notifications.
Notification taps open the affected budget. OS notification permission and app
preferences remain distinct; disabling alerts never disables transaction capture.

### Analytics

Organise the requested graphs into three connected views, rather than a single
long stack of charts:

- **Spending:** a time-series chart with daily/weekly/monthly aggregation, category
  donut and readable rows, highest category, highest day and average daily spend.
- **Cash flow:** income-versus-expense bars and budget-versus-actual category bars.
- **Compare:** current/previous month, equivalent elapsed dates by default when the
  current month is incomplete, category changes and configurable date ranges.

Every chart needs a clear period, units, labels, accessible values and a useful tap
interaction. Selecting a category or point reveals its amount/date and the records
behind it. A comparison explains which periods it uses. Average daily spend uses
the elapsed days within the selected period, not only days with transactions;
monthly projections, if added later, must be labelled estimates.

### Savings and lending

Savings overview separates monthly surplus, monthly savings target and individual
goals. Goal creation/editing has name, amount and optional target date. Goal detail
shows allocated amount, progress, contribution/history and edit/delete actions.
Contributions are allocations/transfers, not new consumption expenses. Deleting a
goal must explain what happens to allocations rather than deleting original bank
transactions. Historical months retain their savings figures and targets.

Preserve lending even though it no longer has a dedicated bottom tab. Home's owed
amount opens a people/transaction list with outstanding and returned filters.
Person detail supports original loans, optional due dates, partial repayments and
Mark returned. Confirmed repayments reduce outstanding principal and retain an
audit trail. Incoming credit SMS alone must not silently settle a loan.

### Settings and profile

Use concise groups: Profile, Appearance, Categories, Budget defaults, Alerts,
Detection & permissions, Security, and Data. Keep display name optional; the
local-first MVP does not require account registration.

Appearance supports system/light/dark. Currency defaults to INR; changing display
preferences must not silently relabel historical rupee amounts as another currency.
Define currency handling before enabling cross-currency totals. No external FX API
is needed for the initial single-currency workspace.

Security includes PIN setup/change, biometric unlock when supported and a PIN
fallback. Local storage and capture permissions remain understandable. Reset data
requires explicit confirmation and states its scope; it does not affect bank
payments or SMS. Keep necessary privacy/permission disclosures in setup/settings,
not repeated as large Home cards.

## Remove or move from the live interface

Remove large live-screen slogans including “Your money, in the clear.”, “Life
happens. Your expenses should keep up.” and the repeated footer tagline. Replace
poetic section headings such as “A little perspective” with meaningful labels.
Move “You pay. We take note.”, the three-step explanation, simulator promotion,
“Get a feel for it.” and “Try a sample SMS” into onboarding/help/sample mode.
Move the large privacy promotional block into Settings while retaining necessary
permission disclosure. Move payment-method summary tiles into Analytics/filters.
Remove duplicate totals and repeated setup explanations after setup is complete.
Keep the compact detection indicator and actionable errors.

## Motion and interaction

- Payment card: preserve slide-in, upward expansion and collapse, with save-first
  behaviour and the existing five-second untouched / ten-second interaction timer.
- Month changes: coordinated 180–250ms transitions for values and charts, keeping
  all displayed figures associated with the same selected period.
- Navigation and sheets: restrained directional movement, approximately 200–300ms.
- Category drill-down: emphasize the selected category and reveal its detail with
  continuity rather than replacing the screen with unrelated content.
- Budget/goal progress: short progress transitions on meaningful changes; labels
  remain immediately understandable. Use haptics for meaningful confirmed actions.
- Respect reduced motion, large fonts, adequate touch targets and screen-reader
  order. Hidden-amount mode must also mask accessible monetary labels. Motion must
  never delay capture, saving or access to information.

## Figma screen and state inventory

After the UX decisions, use the Figma create-file, design and component-library
workflows to create editable screens with shared tokens, reusable components,
light/dark modes and an annotated prototype. Export screen images and a combined
screen board. Do not call a screenshot collection an editable Figma file.

| Group | Frames and key states |
| --- | --- |
| Setup | Intro, SMS permission disclosure/setup, optional first budget/income setup |
| Home | Normal, first-use empty, detection disabled, budget warning/over-limit, month picker |
| History | List, search results, no results, filters/sort sheet |
| Add and detail | Add expense, add income, transaction detail/edit, custom category picker/create, delete confirmation |
| Budgets | Overview, overall budget edit, category budget edit/detail, historical month, threshold warning |
| Analytics | Spending, cash flow, comparison, date picker, selected chart point/category, insufficient history |
| Savings | Overview/history, goal create/edit, goal detail/contribution, delete confirmation |
| Lending | Outstanding/returned list, person detail, partial repayment/mark returned |
| Capture | Compact payment card, expanded editor, category picker, save/discard states |
| Settings | Settings, profile/currency, categories, alert preferences, appearance, PIN/biometric, detection/location permissions, data/reset confirmation |

All primary screens need coherent light/dark styling; representative alternate
states should be shown explicitly. Prototype the Home → category → records → edit,
Home → budget → change limit, Add → save, and payment popup → expand → save journeys.

## Build sequence after design

1. Transaction/income types, exact-paise totals, old-record migration, classifications
   preventing double counts, local persistence and custom categories.
2. Core Home/History/Add flows, monthly/category budgets and core analytics.
3. Alerts, search/filter/sort, comparisons and method/category drill-down.
4. Savings goals, repayment details, app lock and broader customization according
   to final scope. Existing lending visibility remains throughout the rollout.

The user's P0 and P1 scope remains the initial implementation priority. Design can
cover P2 without implying that every P2 feature ships in the first implementation.

## Design handoff — 23 October 2026

62 screens/states in light and dark are prepared under `artifacts/figma`, with PNG boards, a linked HTML prototype and a native Figma development-plugin builder. The new Figma file remains empty because the Starter MCP quota blocked the first canvas mutation. The builder is prepared and statically checked, but has not run inside Figma. This handoff does not change the Android app.
