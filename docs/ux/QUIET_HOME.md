# Quiet experience — 0.2.7 / build 19

The approved Quiet direction covers Home, Analytics and Settings. Light mode uses warm paper, ink and restrained
slate surfaces; dark mode follows the same hierarchy in charcoal. Appearance
continues to follow the existing saved light/dark/system preference.

Home contains today's real spending and local date, unboxed monthly Income and
Expense, a separate budget summary, savings funds and three recent transactions.
Charts stay in Analytics. Unrecorded income is identified rather than invented.
Existing detection setup and lending remain reachable. Amount privacy masks fund
balances, targets and percentages, and hides quantitative progress bars.

## Savings funds

- Read all goals in the selected currency from the existing encrypted planning
  store. Goal contributions remain separate from consumption expenses.
- With multiple goals, show the first card and one peeking layer. Additional
  goals are hidden until expanded, including from accessibility focus.
- Expand in place over 520ms. The top card grows, other cards move into a list,
  and Recent activity moves below it. Reduced motion renders the final state
  directly. Large text increases card heights.
- Every revealed card opens that goal's real detail page, where the existing
  Edit goal, Add contribution, contribution history and confirmed deletion work.
  Returning keeps the list expanded and reflects saved changes.
- One goal opens directly. With no goals, offer goal creation. The expanded
  section also links to managing/creating goals. Android Back collapses an open
  Home stack before leaving the application.

## Payment prompt

The native Android card follows the saved appearance preference. Hide its entire
window before its first frame, then slide it upward with a small scale change
and gentle settling over 480ms. Only the dialog window animates; task isolation,
the transparent host and FLAG_SECURE remain intact. Devices with animations
disabled render it directly. The React Native sample uses a corresponding
spring and resolves reduced-motion preferences before revealing the card.

Capture is still persisted before presentation. Untouched prompts close after
five seconds; interaction resets the idle deadline to ten seconds. Expanding,
editing, vendor-category memory, Save, discard confirmation and notification
fallback keep their existing behavior. No parser, database schema, permission,
signing-key or network-service change is required.

## Verification

Browser checks cover two visible layers, all matching-currency funds, privacy,
narrow layouts, direct single-goal navigation, editing and contributions after
reload. Android `quiet-ui` instrumentation drives the actual React Native stack,
goal editor, contribution editor and encrypted Room store, restoring its original
planning data afterward. The guarded popup runner checks the actual native
prompt over Settings/the launcher, timing, optional edits and restart persistence.
All device checks use the synthetic TraceMoneyMVP AVD, never a physical phone.

## Analytics and Settings

Analytics follows the saved appearance preference, including app chrome, chart
labels, trend strokes and category palettes. Overview, Categories and Compare
retain their data, filters and drilldowns. Totals use lighter typography,
neutral rounded surfaces and underlined navigation. Compare still uses a full
reference month against the selected month through the current day number.

Settings groups navigation into Make it yours, Planning, and Privacy & data.
The profile header is unboxed; rows have glass press feedback. Appearance offers
visual System, Light and Dark previews, preserves the existing preference and
applies it across the app. Existing permission, app-lock and reset flows remain
accessible through their original controls. Version text uses package metadata.

## History

History groups the filtered results by the local calendar date of the payment,
using the same transaction time as details and analytics. Today and Yesterday
include an explicit date, and older days show the date with year. Rows show time
and payment method instead of repeating their group’s date. No new data is stored.

Newest and oldest sorts determine date order. Amount sorts keep dates newest
first and order entries within each day, labelled “Highest/Lowest amount per
day”. Search, month/currency/type/category/method/date filters, empty states and
transaction details continue to use the existing ledger. Day labels refresh at
local midnight and when the app returns to the foreground.
