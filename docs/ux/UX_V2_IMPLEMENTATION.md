# Trace UX v2 — 0.2.0 / build 12

The redesigned Android application is implemented in React Native with the existing Kotlin SMS receiver. The native parser and bank registry remain unchanged.

Home has no chart. It shows recorded monthly spending, income, surplus and budget remaining; clear Manage budgets / Savings goals shortcuts; category summaries, lending and recent activity. Charts are in Analytics. Selected-month context is shared by Home, budgets, savings and analytics.

Budgets and goals are real editable records. Android stores planning documents in Room/SQLite schema 2, encrypted with AES-GCM using the existing Android Keystore key. The explicit 1→2 migration creates the planning table without rebuilding or clearing transactions. Preferences are also local; no cloud backend or bank connection is added. The browser demo stores synthetic records and planning in unencrypted localStorage.

Monthly overall and category limits can be saved independently. Use as monthly default applies to this and future months; older months keep their limits. In-app warnings and local Android notifications support 70/90/100% thresholds. Native checks run after SMS capture and relevant edits, including while React Native is closed. Failure to deliver an optional budget alert must not interrupt a payment save. A given threshold is not repeatedly notified for the same budget limit/month/category.

Income is manually recorded. Incoming bank credits, refunds and reversals are not automatically converted to earned income. Missing income is shown as not recorded. Saved this month means recorded income minus consumption expenses, not an actual bank balance. Own transfers/card-bill payments can be labelled separately to avoid counting a card purchase twice; ambiguous debit alerts still require review.

Lending is excluded from consumption expenses. Repayments reduce the principal outstanding and do not create earned income. Overpayments and reclassifying a repaid loan as an expense are rejected. Deleting a loan removes its related repayment records. Savings-goal contributions track allocations and never create a duplicate expense.

Payment methods are labels. Generic detected card alerts remain Card · unspecified. Users can select Debit card / Credit card explicitly. Currencies are stored per entry; legacy/SMS entries remain INR. Totals filter by the chosen currency rather than converting or relabelling amounts.

Settings → Appearance offers Light, Dark and System default, persisted on the device. Optional app lock uses Android's enrolled strong biometric or screen-lock credential; Trace does not create/store another PIN. While enabled, private payment notifications open the locked app and automatic financial popups are suppressed. Core SMS capture continues.

The compact native payment card rises from the bottom with a damped slide/scale entrance, then settles. Tap/swipe expands it. Its existing five-second untouched timeout, ten-second interaction window, optional remarks/category, immediate Save, discard confirmation and persist-before-display behaviour remain. Android reduced-motion settings are respected. Cross-window blur retains an opaque fallback; the window remains screenshot-protected.

The live app preview is http://127.0.0.1:5173 . Design-only screen boards/prototypes remain at port 5174; those fixed figures are not the real ledger. The Figma canvas remains empty because of its Starter MCP limit; the local design pack includes an import builder.

Validation evidence is collected under `artifacts/ux-v2`. No physical phone is connected during this implementation. The standalone ARM64 preview APK remains debug-signed for local testing; production signing and store distribution are separate work.

Current custom chart ranges support up to 366 days for a readable daily/weekly breakdown. Longer histograms can be scrolled horizontally. The monthly tab normally shows six months; custom ranges group only their selected dates. Previous-month comparison uses matching elapsed dates rather than comparing an incomplete current month with a complete previous month.
