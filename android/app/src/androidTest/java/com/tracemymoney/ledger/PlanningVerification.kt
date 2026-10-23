package com.tracemymoney.ledger
import android.app.Instrumentation
import android.app.NotificationManager
import android.os.SystemClock
import androidx.room.Room
import org.json.JSONArray
import org.json.JSONObject

/** Synthetic data only. Invoked by the existing emulator-guarded instrumentation runner. */
object PlanningVerification {
    fun run(test: Instrumentation, phase: String, repo: LedgerRepository, expect: (Boolean, String) -> Unit) {
        val context = test.targetContext
        val prefs = context.getSharedPreferences("finance.verification", 0)
        fun empty() = JSONObject().put("version", 1).put("months", JSONObject()).put("defaults", JSONObject()).put("categories", JSONArray()).put("goals", JSONArray()).put("contributions", JSONArray()).put("repayments", JSONArray())
        fun defaults() = JSONObject().put("theme", "system").put("currency", "INR").put("name", "").put("alerts", true).put("thresholds", JSONArray(listOf(70,90,100))).put("appLock", false)
        fun record(amount: String, category: String, expense: String = "food"): JSONObject = repo.createManual(JSONObject().put("amount", amount).put("method", "CASH").put("recipient", "Synthetic finance check").put("category", category).put("expenseCategory", expense).put("remarks", "Synthetic only").put("occurredAt", System.currentTimeMillis() - 5000).put("demo", true).put("currency", "INR"))
        if (phase == "finance-environment") {
            repo.detectionEnabled = true; repo.locationEnabled = false
            expect(repo.detectionEnabled && !repo.locationEnabled, "Synthetic test environment enables SMS capture with location off")
        } else if (phase == "finance-prepare") {
            check(!prefs.contains("ids")) { "Finish the previous planning verification first" }
            val original = repo.planning(true).takeIf { it.optInt("version") == 1 } ?: empty()
            val originalPreferences = repo.preferences().takeIf { it.has("theme") } ?: defaults()
            val created = mutableListOf<String>()
            check(prefs.edit().putString("original", original.toString()).putString("preferences", originalPreferences.toString()).putString("ids", "").commit())
            val income = record("60000", "income", "income_salary"); created.add(income.getString("id"))
            val expense = record("787.34", "expense"); created.add(expense.getString("id"))
            val loan = record("3500", "lent"); created.add(loan.getString("id"))
            prefs.edit().putString("ids", created.joinToString(",")).commit()
            expect(repo.find(income.getString("id"))?.getString("category") == "income", "Manual income persists as income rather than an expense")
            expect(repo.find(expense.getString("id"))?.getLong("amountPaise") == 78734L, "Manual expense preserves exact paise in the upgraded ledger")
            val month = java.text.SimpleDateFormat("yyyy-MM", java.util.Locale.US).format(java.util.Date())
            val state = JSONObject(original.toString())
            state.getJSONObject("months").put("INR:$month", JSONObject().put("budget", 3000000).put("limits", JSONObject().put("food", 800000)).put("savingsTarget", 1000000))
            state.getJSONArray("categories").put(JSONObject().put("id", "custom_financecheck").put("name", "Synthetic category").put("icon", "wallet").put("color", "#C7A15A"))
            state.getJSONArray("goals").put(JSONObject().put("id", "finance-goal").put("name", "Synthetic laptop").put("target", 8000000).put("currency", "INR").put("due", "2027-03-31").put("icon", "wallet"))
            state.getJSONArray("contributions").put(JSONObject().put("id", "finance-contribution").put("goalId", "finance-goal").put("amount", 2400000).put("at", System.currentTimeMillis()).put("note", "Synthetic only"))
            state.getJSONArray("repayments").put(JSONObject().put("id", "finance-repayment").put("transactionId", loan.getString("id")).put("amount", 100000).put("at", System.currentTimeMillis()).put("method", "UPI").put("note", "Partial return"))
            repo.savePlanning(true, state)
            val saved = repo.planning(true)
            expect(saved.getJSONObject("months").getJSONObject("INR:$month").getLong("budget") == 3000000L, "Monthly and category budgets persist locally")
            expect(saved.getJSONArray("goals").toString().contains("finance-goal") && saved.getJSONArray("contributions").toString().contains("2400000"), "Goals and contributions persist independently from transactions")
            expect(saved.getJSONArray("repayments").toString().contains("100000"), "Partial repayments persist separately from income")
            val invalid = JSONObject(saved.toString()); invalid.getJSONArray("repayments").getJSONObject(invalid.getJSONArray("repayments").length()-1).put("amount", 350001)
            var rejected = false; try { repo.savePlanning(true, invalid) } catch (_: IllegalArgumentException) { rejected = true }
            expect(rejected && repo.planning(true).toString() == saved.toString(), "An excessive repayment cannot partially overwrite saved planning data")
            val edited = JSONObject(loan.toString()).put("category", "expense").put("transactionAt", loan.getLong("receivedAt")-5000)
            rejected = false; try { repo.editTransaction(edited) } catch (_: IllegalArgumentException) { rejected = true }
            expect(rejected && repo.find(loan.getString("id"))?.getString("category") == "lent", "A repaid loan cannot be silently reclassified as spending")
            val updated = JSONObject(expense.toString()).put("amountPaise", 99999).put("method", "CREDIT_CARD").put("transactionAt", System.currentTimeMillis()-5000).put("expenseCategory", "custom_financecheck")
            repo.editTransaction(updated)
            expect(repo.find(expense.getString("id"))?.getLong("amountPaise") == 99999L && repo.find(expense.getString("id"))?.getString("method") == "CREDIT_CARD", "Transaction editing persists amount, payment method, date and custom category")
            val settings = JSONObject(originalPreferences.toString()).put("theme", "dark"); repo.savePreferences(settings)
            expect(repo.preferences().getString("theme") == "dark", "Theme preference is stored on the device")
            val database = Room.databaseBuilder(context, LedgerDatabase::class.java, "ledger.db").build()
            try { val encrypted = database.planning().find("finance.demo")!!.payload
                expect(!encrypted.contains("Synthetic laptop") && JSONObject(PayloadCipher().decrypt("finance.demo", encrypted)).getJSONArray("goals").toString().contains("finance-goal"), "Planning fields are encrypted before reaching SQLite")
                expect(database.transactions().all().all { !it.payload.startsWith("{") }, "Existing and new transaction payloads remain encrypted")
            } finally { database.close() }
            expect(repo.snapshot().getJSONArray("transactions").length() >= created.size, "The upgraded Room database decrypts and exposes existing transactions")
        } else if (phase == "finance-verify") {
            val ids = prefs.getString("ids", "")!!.split(',').filter { it.isNotEmpty() }; check(ids.size == 3)
            expect(ids.all { repo.find(it) != null } && repo.preferences().getString("theme") == "dark", "Transactions and appearance survive complete process restart")
            val state = repo.planning(true)
            expect(state.getJSONArray("goals").toString().contains("finance-goal") && state.getJSONArray("contributions").toString().contains("finance-contribution"), "Goals and allocations survive complete process restart")
            repo.discard(ids[2])
            expect((0 until repo.planning(true).getJSONArray("repayments").length()).none { repo.planning(true).getJSONArray("repayments").getJSONObject(it).getString("transactionId") == ids[2] }, "Deleting lending removes only its associated repayment records")
            val original = JSONObject(prefs.getString("original", "{}")!!)
            repo.savePlanning(true, original)
            repo.savePreferences(JSONObject(prefs.getString("preferences", "{}")!!))
            ids.forEach { repo.discard(it) }
            expect(ids.all { repo.find(it) == null }, "Verification cleans up its own synthetic records")
            prefs.edit().clear().commit()
        } else if (phase == "finance-alerts") {
            val month = java.text.SimpleDateFormat("yyyy-MM", java.util.Locale.US).format(java.util.Date())
            val key = BudgetAlerts.markerKey("INR", month, "custom_financecheck", 100000L)
            val markers = context.getSharedPreferences("ledger.budgetAlerts", 0); markers.edit().remove(key).commit()
            val state = empty().put("months", JSONObject().put("INR:$month", JSONObject().put("budget", JSONObject.NULL).put("limits", JSONObject().put("custom_financecheck", 100000))))
            val tx = JSONObject().put("category", "expense").put("currency", "INR").put("expenseCategory", "custom_financecheck").put("amountPaise", 70000).put("receivedAt", System.currentTimeMillis())
            val settings = defaults()
            BudgetAlerts.check(context, state, settings, listOf(tx))
            expect(markers.getInt(key, 0) == 70, "Native category notification fires at the 70% threshold")
            val manager = context.getSystemService(NotificationManager::class.java)
            val until = SystemClock.elapsedRealtime() + 4000
            while (manager.activeNotifications.none { it.id == key.hashCode() } && SystemClock.elapsedRealtime() < until) Thread.sleep(100)
            val first = manager.activeNotifications.firstOrNull { it.id == key.hashCode() }
            expect(first != null, "The Android notification manager receives the local budget alert")
            val firstTime = first!!.postTime
            Thread.sleep(50); BudgetAlerts.check(context, state, settings, listOf(tx))
            expect(manager.activeNotifications.first { it.id == key.hashCode() }.postTime == firstTime, "The same budget threshold is not notified repeatedly")
            tx.put("amountPaise", 90000); BudgetAlerts.check(context, state, settings, listOf(tx)); expect(markers.getInt(key, 0) == 90, "Category alert advances to 90%")
            tx.put("amountPaise", 100000); BudgetAlerts.check(context, state, settings, listOf(tx)); expect(markers.getInt(key, 0) == 100, "Category alert advances to 100%")
            manager.cancel(key.hashCode()); markers.edit().remove(key).commit(); settings.put("alerts", false)
            BudgetAlerts.check(context, state, settings, listOf(tx)); expect(!markers.contains(key), "Disabling budget alerts prevents local notifications")
        } else error("Unknown planning verification phase")
    }
}
