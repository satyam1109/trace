# Remembered vendor categories — 0.2.3 / build 15

Trace remembers an expense category only after an explicit category selection in the native payment popup or React Native transaction editor. Manual cash/UPI/card entries can also teach a vendor rule. Auto-save, ignoring a popup, editing a remark, migration and pre-existing categorised history do not create rules.

## Matching and persistence

Android Room schema 3 adds `vendor_rules` with a unique primary key, workspace flag and encrypted payload. The primary key is HMAC-SHA256 of the normalised name and live/sample workspace, using a separate non-exportable Android Keystore key. Name and category are encrypted with the existing AES-GCM payload cipher. Lookup uses the primary-key index; no history scan or vendor list is loaded into RAM for matching. The management list is fetched only when Settings → Remembered vendors opens. No extra SDK, permission, network service or AI model is required.

Names are lowercased with a fixed locale, whitespace is collapsed and outer whitespace is removed. Meaningful words, punctuation and numbers are preserved. Matching is exact: two unrelated vendors with the same extracted name can collide, and different descriptors for one vendor do not automatically merge. Empty names are not remembered. Original extracted SMS names are retained independently of editable recipient labels. Legacy records fall back to their previously saved recipient; past edits cannot be reconstructed from SMS history.

On incoming SMS the repository checks the rule before writing the transaction and running budget alerts. The payment remains persist-first. The existing animated popup still opens; it shows the remembered category in its compact summary and preselects it in the expanded category picker. Ignoring the popup retains the category. A damaged optional rule falls back to Uncategorized, preserving capture.

A category-selection flag travels with the current edit, never becoming a persistent instruction to learn on future saves. A unique-key upsert and transaction write happen together inside a database transaction. Explicit corrections replace the same vendor rule rather than adding duplicates. Uncategorized, income, lending and transfer categories never create expense-vendor memory. Custom categories must exist in the same workspace. Selecting Uncategorized does not forget an existing rule; use the dedicated Forget control for that.

## Lifecycle and controls

Settings → Remembered vendors supports category changes, forgetting one vendor and clearing all rules in the selected workspace, with deletion confirmation. These actions affect future payments only. Individual transaction deletion preserves memory. Removing a custom category deletes its rules. Full local-data reset clears transactions, planning, preferences and vendor rules. Rules survive app closure, phone restart and updates; they have no automatic expiry. Android Clear storage or normal uninstall removes local data. Backup exclusions remain in place. Live and sample rules are separate.

The browser demo uses a separate versioned localStorage object and the same explicit-selection contract. Browser demonstration data is unencrypted and is not the Android database. Demo seed categories never create vendor memory.

## Verification

Evidence is saved in `artifacts/vendor-memory/release-verification.json`. Coverage includes first ignored payment, explicit insertion, upsert, exact case/space matching, retained punctuation/numbers, original SMS identity despite display-name edits, custom-category removal, reset, forgetting, encrypted payloads, indexed lookups, workspace isolation, damaged-rule fallback, native popup selection and cold-process persistence. The 2→3 migration adds an empty table without retrospectively learning history. Existing encrypted transaction payloads are retained; isolated migration instrumentation also checks planning ciphertext preservation.

Verified release: TypeScript and web build passed; 216 JavaScript unit tests, 193 native unit tests, 24 browser flows, 31 native vendor/migration checks, 62 SMS replay checks and 46 popup regression checks passed against the packaged APK. Verification used the isolated AOSP emulator, not a physical phone.
