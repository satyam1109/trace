package com.tracemymoney.ledger

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.room.Room
import org.json.JSONObject

/** Dependency-free device checks. This test APK is never included in the app. */
class LendingVerification : Instrumentation() {
    private var phase = "prepare"
    private var reference = ""

    override fun onCreate(arguments: Bundle?) {
        super.onCreate(arguments)
        phase = arguments?.getString("phase") ?: "prepare"
        reference = arguments?.getString("reference") ?: System.currentTimeMillis().toString()
        start()
    }

    override fun onStart() {
        val checks = mutableListOf<String>()
        fun expect(value: Boolean, name: String) {
            check(value) { name }
            checks.add(name)
        }
        try {
            check(Build.HARDWARE in setOf("ranchu", "goldfish")) { "Synthetic emulator only" }
            val context = targetContext
            val prefs = context.getSharedPreferences("lending.verification", 0)
            val repository = LedgerRepository.get(context)
            if (phase == "quiet-ui") {
                QuietUiVerification.run(this, repository) { value, name -> expect(value, name) }
            } else if (phase == "analytics-ui") {
                AnalyticsUiVerification.run(this) { value, name -> expect(value, name) }
            } else if (phase.startsWith("vendor-")) {
                VendorVerification.run(this, phase, repository) { value, name -> expect(value, name) }
            } else if (phase == "finance-ui") {
                FinanceUiVerification.run(this, repository) { value, name -> expect(value, name) }
            } else if (phase.startsWith("finance-")) {
                PlanningVerification.run(this, phase, repository) { value, name -> expect(value, name) }
            } else if (phase == "popup-task") {
                PopupTaskVerification(this, repository) { value, name -> expect(value, name) }.run()
            } else if (phase.startsWith("popup-")) {
                PopupVerification(this, repository) { value, name -> expect(value, name) }.run(phase)
            } else if (phase == "manual-ui") {
                ManualUiVerification.run(this, repository) { value, name -> expect(value, name) }
            } else if (phase.startsWith("manual")) {
                ManualVerification.run(this, phase, repository) { value, name -> expect(value, name) }
            } else if (phase.startsWith("location")) {
                LocationVerification.run(this, phase, reference, repository) { value, name -> expect(value, name) }
            } else if (phase == "discard") {
                verifyDiscard(repository) { value, name -> expect(value, name) }
            } else if (phase == "prepare") {
                check(!prefs.contains("ids")) { "Finish the previous verification first" }
                val created = repository.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 240.00 to Example Friend via UPI. Ref ${System.currentTimeMillis()}.", System.currentTimeMillis(), true)
                    .getJSONObject("transaction")
                val live = repository.ingest("AD-ICICIB", "INR 763.65 spent on ICICI Bank card ending 4321 at Example Shop. Ref ${System.nanoTime()}.", System.currentTimeMillis(), false)
                    .getJSONObject("transaction")
                val legacyId = "demo-lending-legacy-${System.nanoTime()}"
                val legacy = JSONObject(created.toString()).put("id", legacyId).apply {
                    remove("category"); remove("expenseCategory"); remove("remarks"); remove("locationStatus")
                }
                val database = Room.databaseBuilder(context, LedgerDatabase::class.java, "ledger.db").build()
                try {
                    database.transactions().insert(StoredTransaction().apply {
                        id = legacyId; receivedAt = legacy.getLong("receivedAt"); demo = true
                        payload = PayloadCipher().encrypt(id, legacy.toString())
                    })
                    val ids = listOf(legacyId, created.getString("id"), live.getString("id"))
                    prefs.edit().putString("ids", ids.joinToString(",")).commit()
                    expect(repository.find(legacyId)?.getString("category") == "expense", "Existing payload without a category defaults to Expense")
                    expect(repository.find(legacyId)?.getString("expenseCategory") == "uncategorised" && repository.find(legacyId)?.getString("remarks") == "", "Legacy records get empty remarks and an uncategorised expense without data loss")
                    expect(created.getString("category") == "expense" && live.getString("category") == "expense", "New sample and live captures default to Expense")
                    repository.update(legacyId, "Example Friend", "lent")
                    repository.update(live.getString("id"), "Example Shop", "lent")
                    repository.update(legacyId, "Renamed Friend")
                    repository.update(created.getString("id"), "Lunch friend", "expense", "food", "Shared lunch\nSplit later")
                    repository.update(created.getString("id"), "Lunch friend renamed")
                    expect(repository.find(created.getString("id"))?.getString("remarks") == "Shared lunch\nSplit later" && repository.find(created.getString("id"))?.getString("expenseCategory") == "food", "Recipient-only popup edits preserve manual remarks and expense category")
                    val beforeInvalid = repository.find(created.getString("id"))!!.toString()
                    var invalidExpense = false
                    try { repository.update(created.getString("id"), "Incorrect", "expense", "invalid", "Incorrect") }
                    catch (_: IllegalArgumentException) { invalidExpense = true }
                    expect(invalidExpense && repository.find(created.getString("id"))!!.toString() == beforeInvalid, "Invalid expense categories cannot partially overwrite a payment")
                    repository.update(created.getString("id"), "Lunch friend renamed", remarks = "x".repeat(600))
                    expect(repository.find(created.getString("id"))!!.getString("remarks").length == 500, "Native storage enforces the manual remarks length limit")
                    repository.update(created.getString("id"), "Lunch friend renamed", remarks = "Shared lunch\nSplit later")
                    expect(repository.find(legacyId)?.getString("category") == "lent", "Recipient-only native popup edit preserves the lending category")
                    expect(repository.find(legacyId)?.getLong("amountPaise") == 24000L && repository.find(live.getString("id"))?.getLong("amountPaise") == 76365L, "Categorisation preserves amounts and original record identity")
                    val encrypted = database.transactions().find(legacyId)!!.payload
                    expect(!encrypted.startsWith("{") && JSONObject(PayloadCipher().decrypt(legacyId, encrypted)).getString("category") == "lent", "Lending category is persisted inside the encrypted payload")
                    var rejected = false
                    try { repository.update(legacyId, "Changed", "unsupported") }
                    catch (_: IllegalArgumentException) { rejected = true }
                    expect(rejected && repository.find(legacyId)?.getString("recipient") == "Renamed Friend", "Invalid categories cannot mutate the record")
                    val snapshot = repository.snapshot().getJSONArray("transactions")
                    val own = (0 until snapshot.length()).map { snapshot.getJSONObject(it) }.filter { it.getString("id") in ids }
                    expect(own.size == 3 && own.filter { it.getString("category") == "lent" }.sumOf { it.getLong("amountPaise") } == 100365L, "Snapshot exposes the exact lent total while retaining normal expenses")
                    expect(own.single { !it.getBoolean("demo") }.getString("category") == "lent", "Live transactions support lending independently of sample records")
                } finally { database.close() }
            } else {
                check(phase == "verify") { "Unknown verification phase" }
                val ids = prefs.getString("ids", "")!!.split(",")
                check(ids.size == 3) { "Run prepare before verify" }
                val legacy = repository.find(ids[0])!!
                val ordinary = repository.find(ids[1])!!
                val live = repository.find(ids[2])!!
                expect(legacy.getString("category") == "lent" && live.getString("category") == "lent" && ordinary.getString("category") == "expense", "Categories survive a complete app process restart")
                expect(ordinary.getString("remarks") == "Shared lunch\nSplit later" && ordinary.getString("expenseCategory") == "food", "Manual remarks and selected expense category survive process restart")
                expect(legacy.getString("recipient") == "Renamed Friend" && legacy.getLong("amountPaise") + live.getLong("amountPaise") == 100365L, "Recipient and exact-paise total survive restart")
                repository.update(ids[0], legacy.getString("recipient"), "expense")
                expect(repository.find(ids[0])?.getString("category") == "expense", "A lent entry can be reclassified as Expense")
                val before = repository.snapshot().getJSONArray("transactions").length()
                ids.forEach { repository.discard(it) }
                expect(ids.all { repository.find(it) == null } && repository.snapshot().getJSONArray("transactions").length() == before - 3, "Deletion removes only this test's synthetic records")
                prefs.edit().clear().commit()
            }
            finish(Activity.RESULT_OK, Bundle().apply {
                putString("result", "PASS")
                putString("phase", phase)
                putString("checks", checks.joinToString("\n"))
            })
        } catch (error: Throwable) {
            finish(Activity.RESULT_CANCELED, Bundle().apply {
                putString("result", "FAIL")
                putString("error", error.toString())
                putString("checks", checks.joinToString("\n"))
            })
        }
    }

    private fun verifyDiscard(repository: LedgerRepository, expect: (Boolean, String) -> Unit) {
        fun allNodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else listOf(root) + (0 until root.childCount).flatMap { allNodes(root.getChild(it)) }
        val record = repository.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 240.00 to Example Friend via UPI. Ref ${System.currentTimeMillis()}.", System.currentTimeMillis(), true)
            .getJSONObject("transaction")
        val id = record.getString("id")
        val activity = startActivitySync(Intent(targetContext, PaymentPromptActivity::class.java)
            .putExtra("transactionId", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try {
            check(waitUntil { allNodes(uiAutomation.rootInActiveWindow).any { it.contentDescription?.toString() == "Show payment details" } })
            allNodes(uiAutomation.rootInActiveWindow).first { it.contentDescription?.toString() == "Show payment details" }.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            clickButton("Discard")
            expect(waitUntil { button("Keep entry") != null } && repository.find(id) != null, "Opening native discard confirmation does not delete the payment")
            Thread.sleep(11_000)
            expect(button("Keep entry") != null && repository.find(id) != null, "Native confirmation pauses the automatic popup timeout")
            clickButton("Keep entry")
            expect(waitUntil { button("Discard") != null } && repository.find(id) != null, "Keep entry returns to the native popup without deleting the record")
            clickButton("Discard")
            check(waitUntil { button("Keep entry") != null }) { "Native confirmation did not become ready for Back" }
            sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
            expect(waitUntil { button("Discard") != null } && repository.find(id) != null, "Android Back dismisses confirmation and retains the record")
            clickButton("Discard")
            clickButton("Discard entry")
            expect(waitUntil { repository.find(id) == null }, "Only confirming Discard entry removes the native record")
        } finally {
            repository.discard(id)
            runOnMainSync { if (!activity.isFinishing) activity.finish() }
        }
    }

    private fun button(label: String): AccessibilityNodeInfo? = uiAutomation.rootInActiveWindow
        ?.findAccessibilityNodeInfosByText(label)?.firstOrNull {
            it.isClickable && it.text?.toString().equals(label, ignoreCase = true)
        }

    private fun waitUntil(condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + 8_000
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return true
            Thread.sleep(100)
        }
        return false
    }

    private fun clickButton(label: String) {
        check(waitUntil { button(label) != null }) { "Missing native button: $label" }
        check(button(label)!!.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { "Cannot click: $label" }
        waitForIdleSync()
    }
}
