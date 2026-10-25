package com.tracemymoney.ledger

import android.app.Instrumentation
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.room.Room
import org.json.JSONArray
import org.json.JSONObject

/** Synthetic-only tests dispatched by the emulator-guarded instrumentation runner. */
object VendorVerification {
    fun run(test: Instrumentation, phase: String, repo: LedgerRepository, expect: (Boolean, String) -> Unit) {
        val prefs = test.targetContext.getSharedPreferences("vendor.verification", 0)
        fun rules() = repo.vendorRules(true)
        fun rule(name: String): JSONObject? = rules().let { list -> (0 until list.length()).map { list.getJSONObject(it) }.firstOrNull { VendorIdentity.normalise(it.getString("name")) == VendorIdentity.normalise(name) } }
        val ids = mutableListOf<String>()
        fun capture(name: String, demo: Boolean = true): JSONObject {
            val tx = repo.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 64.00 to $name via UPI. Ref ${System.nanoTime()}.", System.currentTimeMillis(), demo).getJSONObject("transaction")
            ids.add(tx.getString("id")); return tx
        }
        if (phase == "vendor-migration") {
            val file = test.targetContext.getDatabasePath("vendor-migration-verification.db")
            test.targetContext.deleteDatabase(file.name)
            val encrypted = PayloadCipher().encrypt("legacy-vendor-test", "{\"category\":\"expense\"}")
            val plan = PayloadCipher().encrypt("finance.live", "{\"version\":1,\"categories\":[]}")
            SQLiteDatabase.openOrCreateDatabase(file, null).use { legacy ->
                legacy.execSQL("CREATE TABLE transactions (id TEXT NOT NULL PRIMARY KEY, payload TEXT NOT NULL, receivedAt INTEGER NOT NULL, demo INTEGER NOT NULL)")
                legacy.execSQL("CREATE TABLE planning (`key` TEXT NOT NULL PRIMARY KEY, payload TEXT NOT NULL)")
                legacy.execSQL("INSERT INTO transactions VALUES (?, ?, ?, ?)", arrayOf("legacy-vendor-test", encrypted, 123L, 0))
                legacy.execSQL("INSERT INTO planning VALUES (?, ?)", arrayOf("finance.live", plan))
                legacy.version = 2
            }
            val migrated = Room.databaseBuilder(test.targetContext, LedgerDatabase::class.java, file.name).addMigrations(LedgerRepository.MIGRATION_2_3).build()
            try {
                expect(migrated.transactions().find("legacy-vendor-test")?.payload == encrypted, "Schema 2→3 migration preserves existing encrypted transaction bytes")
                expect(migrated.planning().find("finance.live")?.payload == plan, "Schema 2→3 migration preserves encrypted planning documents")
                expect(migrated.vendors().all(false).isEmpty() && migrated.vendors().all(true).isEmpty(), "Migration creates an empty vendor table without inferring historical rules")
                val query = migrated.openHelper.readableDatabase.query("EXPLAIN QUERY PLAN SELECT * FROM vendor_rules WHERE `key` = 'synthetic'")
                query.use { expect(it.moveToFirst() && it.getString(3).contains("INDEX"), "Vendor lookups use the primary-key index") }
            } finally { migrated.close(); test.targetContext.deleteDatabase(file.name) }
        } else if (phase == "vendor-prepare") {
            check(!prefs.contains("name")) { "Finish prior vendor verification first" }
            val name = "Vendor Memory ${System.currentTimeMillis()}"
            val before = rules().length()
            val first = capture(name)
            expect(first.getString("expenseCategory") == "uncategorised" && rules().length() == before, "First uncategorised payment saves without inserting any vendor rule")
            repo.update(first.getString("id"), name, "expense", "uncategorised", "Only a remark", false)
            expect(rules().length() == before, "Remarks and popup autosave do not create vendor memory")
            val second = capture(name)
            repo.update(second.getString("id"), "My shop nickname", "expense", "groceries", "", true)
            expect(rules().length() == before + 1 && rule(name)?.getString("category") == "groceries", "First explicit category inserts a single vendor rule using the original SMS name")
            val key = rule(name)!!.getString("key")
            val db = Room.databaseBuilder(test.targetContext, LedgerDatabase::class.java, "ledger.db").build()
            try {
                val row = db.vendors().find(key)!!
                expect(key.matches(Regex("[0-9a-f]{64}")) && !row.payload.contains(name) && !row.payload.contains("groceries"), "Vendor name and category are encrypted; primary index contains a keyed digest")
                expect(JSONObject(PayloadCipher().decrypt(key, row.payload)).getString("category") == "groceries", "Encrypted vendor row decrypts with the existing Android Keystore cipher")
                val originalPayload = row.payload
                row.payload = "damaged-synthetic-rule"; db.vendors().save(row)
                try { expect(capture(name).getString("expenseCategory") == "uncategorised", "A damaged optional vendor rule cannot block payment capture") }
                finally { row.payload = originalPayload; db.vendors().save(row) }
            } finally { db.close() }
            val third = capture("  ${name.uppercase()}  ")
            expect(third.getString("expenseCategory") == "groceries" && third.getString("categorySource") == "vendor", "A repeat name with different case and spacing is categorised before the popup")
            expect(repo.find(first.getString("id"))!!.getString("expenseCategory") == "uncategorised", "Learning does not rewrite older uncategorised payments")
            val live = capture(name, false)
            expect(live.getString("expenseCategory") == "uncategorised", "Sample rules never categorise live payments")
            expect(capture("$name 2").getString("expenseCategory") == "uncategorised", "Meaningful vendor numbers remain distinct")
            repo.update(third.getString("id"), third.getString("recipient"), "expense", "food", "", false)
            expect(rule(name)!!.getString("category") == "groceries", "An automatically supplied category cannot overwrite a remembered rule")
            repo.update(third.getString("id"), third.getString("recipient"), "expense", "food", "", true)
            expect(rules().length() == before + 1 && rule(name)!!.getString("category") == "food", "Explicit corrections upsert the same unique vendor record")
            repo.forgetVendorRule(true, key)
            repo.update(third.getString("id"), third.getString("recipient"), "expense", "food", "Another remark", false)
            expect(rule(name) == null, "A forgotten rule is not recreated by an old popup or remark edit")
            repo.update(third.getString("id"), third.getString("recipient"), "expense", "uncategorised", "", true)
            expect(rule(name) == null, "Explicitly choosing Uncategorized does not create memory")
            repo.update(third.getString("id"), third.getString("recipient"), "expense", "groceries", "", true)
            val known = capture(name)
            // Leave one learned rule for the cold-process phase.
            prefs.edit().putString("name", name).putString("ids", JSONArray(ids).toString()).putString("known", known.getString("id")).commit()
            repo.discard(second.getString("id"))
            expect(rule(name) != null, "Deleting an individual transaction preserves vendor memory")
        } else {
            check(phase == "vendor-verify")
            val name = prefs.getString("name", null) ?: error("Run vendor-prepare first")
            val key = rule(name)!!.getString("key")
            val oldIds = JSONArray(prefs.getString("ids", "[]"))
            try {
                expect(rule(name)?.getString("category") == "groceries", "Vendor memory survives complete app process restart")
                val tx = capture(name)
                expect(tx.getString("expenseCategory") == "groceries", "Cold-process capture applies the persisted rule before showing UI")
                fun nodes(n: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (n == null) emptyList() else listOf(n) + (0 until n.childCount).flatMap { nodes(n.getChild(it)) }
                val activity = test.startActivitySync(PaymentPromptActivity.launchIntent(test.targetContext, tx.getString("id")))
                try {
                    val deadline = SystemClock.elapsedRealtime() + 4000
                    var visible = false
                    while (SystemClock.elapsedRealtime() < deadline && !visible) {
                        visible = nodes(test.uiAutomation.rootInActiveWindow).any { it.isVisibleToUser && it.text?.toString()?.contains("Groceries · Remembered") == true }
                        Thread.sleep(100)
                    }
                    expect(visible, "Native compact payment popup still opens and displays the remembered category")
                    Thread.sleep(5500)
                    expect(repo.find(tx.getString("id"))?.getString("expenseCategory") == "groceries", "Untouched native popup retains the automatically selected category")
                } finally { test.runOnMainSync { if (!activity.isFinishing) activity.finish() } }
                val selectable = capture(name)
                val editor = test.startActivitySync(PaymentPromptActivity.launchIntent(test.targetContext, selectable.getString("id")))
                fun until(condition: () -> Boolean): Boolean {
                    val end = SystemClock.elapsedRealtime() + 6000
                    while (SystemClock.elapsedRealtime() < end) { if (condition()) return true; Thread.sleep(100) }
                    return false
                }
                fun click(label: String) {
                    check(until {
                        val all = nodes(test.uiAutomation.rootInActiveWindow)
                        val found = all.any { it.isVisibleToUser && (it.text?.toString().equals(label, ignoreCase = true) || it.contentDescription?.toString().equals(label, ignoreCase = true)) }
                        if (!found) all.filter { it.isScrollable && it.isVisibleToUser }.forEach { it.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) }
                        found
                    }) { "Missing $label" }
                    var node = nodes(test.uiAutomation.rootInActiveWindow).first { it.isVisibleToUser && (it.text?.toString().equals(label, ignoreCase = true) || it.contentDescription?.toString().equals(label, ignoreCase = true)) }
                    while (!node.isClickable) node = node.parent ?: error("Not clickable: $label")
                    check(node.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                }
                try {
                    Thread.sleep(500)
                    click("Show payment details"); Thread.sleep(350)
                    click("Choose category"); click("Food"); Thread.sleep(350); click("Save")
                    expect(until { rule(name)?.getString("category") == "food" }, "Choosing a category in the actual native popup upserts vendor memory")
                    expect(repo.find(selectable.getString("id"))?.getString("expenseCategory") == "food", "Native popup saves the selected category to the payment too")
                } finally { test.runOnMainSync { if (!editor.isFinishing) editor.finish() } }
                repo.editVendorRule(true, key, "health")
                expect(capture(name).getString("expenseCategory") == "health", "Settings changes affect future payments")
                expect(repo.find(tx.getString("id"))!!.getString("expenseCategory") == "groceries", "Changing vendor settings leaves old transaction categories unchanged")
                repo.forgetVendorRule(false, key)
                expect(rule(name) != null, "Workspace-scoped delete cannot remove another workspace's vendor rule")
                repo.forgetVendorRule(true, key)
                expect(capture(name).getString("expenseCategory") == "uncategorised", "Forgetting a vendor returns future payments to Uncategorized")
                val original = repo.planning(true)
                val state = JSONObject(original.toString()).put("version", 1)
                for (field in listOf("months", "defaults")) if (!state.has(field)) state.put(field, JSONObject())
                for (field in listOf("categories", "goals", "contributions", "repayments")) if (!state.has(field)) state.put(field, JSONArray())
                val custom = "custom_vendor_verification"
                try {
                    state.getJSONArray("categories").put(JSONObject().put("id", custom).put("name", "Synthetic vendor category").put("color", "#C7A15A").put("icon", "bag"))
                    repo.savePlanning(true, state)
                    val own = capture(name)
                    repo.update(own.getString("id"), name, "expense", custom, "", true)
                    expect(capture(name).getString("expenseCategory") == custom, "Existing custom expense categories can be remembered")
                    val restore = JSONObject(state.toString()).put("categories", original.optJSONArray("categories") ?: JSONArray())
                    repo.savePlanning(true, restore)
                    expect(rule(name) == null && capture(name).getString("expenseCategory") == "uncategorised", "Deleting a custom category removes its vendor rules")
                } finally { repo.savePlanning(true, JSONObject(state.toString()).put("categories", original.optJSONArray("categories") ?: JSONArray())) }
            } finally {
                repo.forgetVendorRule(true, key)
                for (i in 0 until oldIds.length()) repo.discard(oldIds.getString(i))
                ids.forEach { repo.discard(it) }; prefs.edit().clear().commit()
            }
        }
    }
}
