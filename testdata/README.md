# Bank SMS regression fixtures

`bank-sms.tsv` is a UTF-8, tab-separated corpus used by Kotlin and TypeScript tests.
Each non-comment row contains nine fields:

`id`, `sender`, `amountPaise-or-IGNORE`, `bank`, `account`, `method`, `recipient`,
`reference`, `body`.

Use `-` for an expected empty field and literal `\n` for a message line break.
Use only synthetic account, recipient, reference, balance and contact values.
Keep sender tokens and wording needed to reproduce the particular template.
Expected amounts are integer paise, never a floating-point rupee value.

For every accepted format, include counterexamples that could be mistaken for a
debit. A passing corpus is a regression gate for these examples, not proof of
coverage for all banks or all templates. See `docs/SMS_COVERAGE.md` for the release
and physical-device verification workflow. Gradle tracks this corpus as a test
input, so changing fixture data invalidates cached test results.

`bank-sms-sources.json` records pinned research sources for the researched fixtures.
The per-bank matrix and limitations are in `docs/SMS_RESEARCH.md`. Source wording
is adapted with synthetic personal and transaction values, not copied from a
connected phone. Sender profiles live in `src/data/smsBanks.json`; run
`npm run generate:banks` after updating them. The Android build generates its
Kotlin registry from that file, and the test precheck rejects a stale registry.
