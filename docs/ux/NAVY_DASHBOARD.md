# Navy dashboard — 0.2.2 / build 14

Implemented on 24 October 2026 in the shared React Native Home screen. The browser preview runs the same components with a synthetic, isolated ledger.

## Layout and interaction

- Unboxed **Spent today** hero and actual device-local date. A local-midnight timer and app-resume refresh keep the total current. Selecting a historical reporting month does not change this total; tapping it filters History to today.
- Separate rounded **Income** and **Expense** panels scoped to the selected month. Missing income offers entry rather than inventing a zero. Recorded income opens Income; Expense opens filtered History.
- Rounded **Monthly budget** panel with actual remaining/over-budget amount and utilisation. An unset budget offers setup rather than fake progress. Manage opens overall/category limits. The blue-gray **Savings goal** row inside the same panel opens the existing goal workflow.
- Generous spacing before rounded **Recent activity**, ivory in light mode and slate in dark mode. Existing transaction editing and lending/repayment navigation remain accessible. No graphs or external shared-expense integration appear on Home.
- Navy canvas and muted gold details; 28–32 dp main radii. The approved navy Home remains navy in both themes, while activity, sheets and the other screens respect the selected theme.

All amounts come from the existing finance model, including currency separation and exclusion of lending, transfers and marked card-bill repayments from consumption expenses. This revision does not change native SMS parsing, encrypted storage or the isolated payment popup.

## Motion and accessibility

`GlassPressable` provides a translucent highlight, fine rim and subtle 0.985 press scale. Android uses a layered visual highlight; the browser additionally uses a CSS backdrop filter. No Apple framework or native blur dependency is added. Reduced motion removes scale animation and applies the highlight immediately. Keyboard focus remains visible. Existing hide-amounts controls apply throughout Home. Metrics stack for large text or very large amounts on narrow phones.

The budget summary and savings action are sibling buttons within one noninteractive panel, keeping native accessibility targets distinct. Cards expose descriptive labels and preserve filtered navigation.

## Verification

- TypeScript passed; 206 JavaScript unit tests passed.
- All 19 browser flows passed, covering section navigation, budget/goal persistence, manual entries, local-midnight rollover, amount hiding, large amounts on narrow phones, popup behaviour and reduced motion.
- Android release and instrumentation APK builds passed. Five native finance UI checks verified budget/goal writes through the TurboModule into encrypted Room, picker cancellation and return to Home.
- All 191 native parser unit tests and 62 cold-process SMS emulator checks passed, including the researched positive/negative corpus across 19 issuer profiles. Final APK identity and signature evidence is recorded in `artifacts/navy-dashboard/release-verification.json`.

Screenshots in `artifacts/navy-dashboard/` use isolated synthetic data. The standalone APK is `artifacts/trace-v0.2.2-build14.apk` (ARM64). It uses the existing local-preview signing key. No physical phone was connected during this verification.
