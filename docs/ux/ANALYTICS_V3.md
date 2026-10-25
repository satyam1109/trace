# Analytics — 0.2.4 / build 16

The approved spending-story and category-focus designs are implemented in the shared React Native UI. Analytics uses the navy/gold palette, three accessible tabs, rounded surfaces, restrained transitions and reduced-motion support. Home remains graph-free. No dependencies, permissions, storage schema or native SMS parser changes were required.

## Views

**Overview** presents recorded spending for the selected month or applied date range, one daily/weekly/monthly trend, a largest-category insight, compact category rows, daily average and highest spending day. Tapping or dragging across the trend selects a bucket; the value and date range appear below it. A separate action opens the matching payments. Previous/Next actions provide an alternative to pointer gestures. Weekly drill-down uses the entire selected week; monthly exploration labels the six calendar months explicitly. Custom ranges allow up to 366 days and also apply to Categories.

**Categories** gives the donut enough space, puts recorded total at its centre and keeps a ranked list with amounts and percentages. Selecting a segment or row selects the category. Explore opens a category sheet with top vendors and date-filtered transaction navigation. Unknown legacy category IDs retain their amounts, so the donut and category totals still account for every recorded expense. Custom category colours are preserved. Payment methods remain available in a disclosure.

**Compare** follows the user's revised period rule: the baseline is a full completed calendar month, while the target is day 1 through the current day number, capped at the target month's last day. For example, 1–30 September versus 1–25 October; selecting August as the target uses 1–25 August, not all of August. Both months can be chosen independently. The main header follows the target month. Future baseline months and selecting the same month on both sides are disabled.

Compare shows two amount-labelled horizontal bars, an absolute/percentage recorded change when both periods contain expenses, category differences sorted by rupee impact and one deterministic takeaway. Category detail provides separate buttons for target and full baseline records, carrying explicit date filters so History does not silently fall back to the header month. Income and surplus, and budget-versus-actual detail, remain collapsed until requested. Unrecorded income is labelled rather than fabricated as zero. Missing expense records do not produce an invented percentage or spending-decrease claim.

## Calculation and interaction details

- Integer-paise amounts, currency separation, manual transaction time precedence, and exclusion of lending and own/card-bill transfers are retained. No currency conversion is performed.
- Local calendar dates, leap years and different month lengths are handled independently. Full-baseline totals include late-month payments beyond the target cutoff. Future-dated records are excluded from recorded totals.
- Overview retains full historical-month reporting; the special target cutoff belongs to Compare. Its comparison badge uses the explicitly labelled full previous month.
- A shared local-midnight/app-resume hook refreshes date boundaries in Home and Analytics. Average daily spending includes zero-spend days.
- Chart pointer coordinates are measured against the chart surface, avoiding SVG-child-origin selection errors. SVG charts have accessible names and text alternatives; reduced motion removes transitions and press scaling.
- Budget comparison uses the target range against its full monthly limit. Zero limits show overspending; absent category limits do not display misleading progress.

Screenshots in `artifacts/analytics-v3/` use an isolated synthetic ledger and do not alter the existing browser workspace. Release and test evidence is recorded in `artifacts/analytics-v3/release-verification.json`. The standalone ARM64 APK uses the existing local-preview signing key. No physical phone was connected during verification.

Verified release: TypeScript and web build passed, with 227 JavaScript unit tests, 193 native unit tests, 30 browser flows, eight native Analytics UI checks and 62 SMS replay checks. APK signature and installed-APK identity were verified. The eight native checks include all three tabs, independent month selection, unrecorded-income handling and native date-picker cancellation.
