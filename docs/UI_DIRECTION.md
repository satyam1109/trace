# Proposed UI direction

Trace now uses the approved navy-and-gold palette. The broader layout proposals
below remain ideas for a later design pass.

## Implemented in 0.1.3 build 11

Detected payments now start as an animated compact card near the bottom, showing
only amount, source and recipient. Swipe upward or tap the header to expand the
optional editor, or dismiss immediately without losing the saved payment. The
expanded sheet has remarks, category and a prominent full-width Save action.
Collapse/reopen preserves drafts. The compact window leaves the background
undimmed; the expanded state adds a light scrim. Rounded navy glass, a fine border
and a highlight retain the gold money accent. Native blur follows system support
and falls back to an opaque gradient. Motion respects disabled animations.
See [popup behaviour and verification](PAYMENT_POPUP.md).

## Implemented in 0.1.3 build 10

The detected-payment popup exposes optional Remarks and Category above Save.
An untouched popup closes after five seconds; each interaction resets ten idle
seconds. Category selection and discard confirmation pause the countdown. Native
editing and automatic dismissal preserve the metadata in the encrypted ledger.
The browser simulator mirrors this interaction in a dedicated component; full
history editing remains untimed. See [popup details](PAYMENT_POPUP.md).

## Implemented in 0.1.3 build 8

Transaction details now includes manual Remarks below Recipient and a Category
dropdown for expenses and Lent money. Location is optional, off by default, and
captures a bounded device estimate near receipt of a newly detected debit SMS.
It displays coordinates, accuracy, fix time and the approximate-location label.
No location is invented for historical or sample payments. See
[details and location](DETAILS_AND_LOCATION.md) for setup, privacy and testing.

## Implemented in 0.1.3 build 7

| Role | Colour |
| --- | --- |
| Primary buttons, summary cards and navigation | Navy `#17233D` |
| Highlighted totals and icons on navy | Gold `#C7A15A` |
| Page background | Soft grey `#F6F7FB` |
| Transaction cards | White `#FFFFFF` |
| Body text | Ink `#202638` |
| Secondary text on light surfaces | Slate `#5F6B80` |

The shared React Native/browser palette is in `src/theme.ts`; Android resources
are in `android/app/src/main/res/values/colors.xml`. The theme also covers the
incoming-SMS popup, its controls, notification accent and launcher icon.
Gold text uses navy backgrounds. On light surfaces, gold labels use the darker
`#76551D` shade. Active mobile navigation has a navy background, gold icon and
white label. Red remains for errors and destructive actions.

Thirteen key text/background pairs were checked against 4.5:1 contrast; the
lowest ratio is 4.76:1. This checks the listed colour combinations, not a full
accessibility audit. The ratios and tested APK hash are in
`artifacts/theme-check.json`. Preview screenshots:
`artifacts/overview-mobile.png`, `artifacts/overview-desktop.png`,
`artifacts/lent-money-mobile.png`, `artifacts/transaction-details-mobile.png`
and `artifacts/discard-confirmation-mobile.png`.

## Implemented in 0.1.3 build 6

- Opening a saved transaction on mobile uses the screen's full width, with no
  exterior side margins or rounded dialog corners. Internal padding remains for
  readable text and comfortable controls. Desktop uses a compact dialog.
- Discard opens a separate confirmation with **Keep entry** and **Discard entry**.
  Nothing is removed until the destructive action is confirmed. Cancelling keeps
  unsaved recipient/category edits in the editor. The confirmation identifies
  the saved payment and mentions its lent total when relevant.
- The native incoming-SMS popup also confirms discard and pauses its closing
  timer while the user decides. Android Back or Keep entry preserves the record.

Previews: `artifacts/transaction-details-mobile.png` and
`artifacts/discard-confirmation-mobile.png`. Both contain synthetic demo data.

## Suggested screen structure

| Screen | Proposed layout |
| --- | --- |
| Overview | Two prominent cards: outgoing payments this month and money expected back. Recent payments directly underneath. Detection status as a compact pill. Keep the chart secondary. |
| Transactions | Group rows under Today, Yesterday and dates. Make recipient and amount the strongest text. Show bank, time and category on a smaller second line. Keep search and simple filters near the top. |
| Transaction details | A clear Payment details header with Back. Amount and recipient first, then Category, source account and receipt date/time. Put Save changes in a persistent bottom action bar above the keyboard. Keep discard visually separate from Save. Hide unavailable fields instead of showing repeated Unknown labels. |
| Lent money | Total expected back, then groups by person with individual payments inside. A later repayment feature could add Mark returned and a returned-history view; it would require its own persisted repayment state, not reclassifying loans as expenses. |
| Privacy / settings | A small list: Detection, Permissions, Data and About. Keep important SMS status visible; put technical explanations behind expandable details. |

## Readability and interaction

- Use a consistent sans-serif face for financial records, 14–16 sized body text
  and larger amounts. Reserve decorative headings for branding.
- Increase contrast on labels and secondary text. Never rely only on green or
  red to explain an entry's meaning; keep visible labels.
- Give important controls comfortable touch targets of at least 48 dp. Make the
  primary save action easy to reach while scrolling or using the keyboard.
- Use the same spacing, category badges and icons across all four tabs.
- Keep newly detected payments brief: amount, recipient/source, saved status and
  Edit. Category selection can stay in the full detail screen.

This layout is a design recommendation for this app. Android's guidance supports
[adapting dialog content to screen size and using explicit dialog actions](https://developer.android.com/develop/ui/views/components/dialogs)
and [48 dp touch targets with accessible labels and contrast](https://developer.android.com/guide/topics/ui/accessibility/apps).
