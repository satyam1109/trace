package com.tracemymoney.ledger

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.graphics.Rect
import android.view.MotionEvent
import android.view.WindowManager
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject

/** Native UI and encrypted storage checks, invoked only by the emulator-guarded runner. */
class PopupVerification(private val test: Instrumentation, private val repository: LedgerRepository, private val expect: (Boolean, String) -> Unit) {
    private val prefs = test.targetContext.getSharedPreferences("popup.verification", 0)
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun find(label: String) = nodes(test.uiAutomation.rootInActiveWindow).firstOrNull {
        it.contentDescription?.toString().equals(label, ignoreCase = true) || it.text?.toString().equals(label, ignoreCase = true)
    }
    private fun until(timeout: Long = 8000, condition: () -> Boolean): Boolean {
        val end = SystemClock.elapsedRealtime() + timeout
        while (SystemClock.elapsedRealtime() < end) { if (condition()) return true; Thread.sleep(100) }
        return false
    }
    private fun click(label: String) {
        check(until { find(label) != null }) { "Missing popup control: $label" }
        check(find(label)!!.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { "Cannot click $label" }
    }
    private fun fill(value: String) {
        check(until { find("Payment remarks")?.isEditable == true }) { "Remarks input missing" }
        check(find("Payment remarks")!!.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
        }))
    }
    private fun record(): JSONObject {
        val item = repository.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 240.00 to Example Popup via UPI. Ref ${System.nanoTime()}.", System.currentTimeMillis(), true).getJSONObject("transaction")
        val ids = prefs.getString("ids", "")!!.split(',').filter { it.isNotEmpty() } + item.getString("id")
        check(prefs.edit().putString("ids", ids.joinToString(",")).commit())
        return item
    }
    private fun open(record: JSONObject): Activity {
        val activity = test.startActivitySync(PaymentPromptActivity.launchIntent(test.targetContext, record.getString("id")))
        check(until { find("Show payment details") != null }) { "Compact payment summary did not render" }
        return activity
    }
    private fun expand() { click("Show payment details"); check(until { find("Payment remarks")?.isVisibleToUser == true }) }
    private fun swipeUp() {
        val bounds = Rect(); find("Show payment details")!!.getBoundsInScreen(bounds)
        val down = SystemClock.uptimeMillis(); val x = bounds.centerX().toFloat(); val y = bounds.centerY().toFloat()
        fun event(action: Int, at: Float) { val event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, at, 0); test.sendPointerSync(event); event.recycle() }
        event(MotionEvent.ACTION_DOWN, y)
        repeat(12) { Thread.sleep(16); event(MotionEvent.ACTION_MOVE, y - (it + 1) * 12f) }
        event(MotionEvent.ACTION_UP, y - 144f)
        check(until { find("Payment remarks")?.isVisibleToUser == true }) { "Swipe did not expand payment sheet" }
    }
    private fun finish(activity: Activity) { test.runOnMainSync { if (!activity.isFinishing) activity.finish() } }

    fun run(phase: String) {
        when (phase) {
            "popup-reset" -> {
                prefs.getString("ids", "")!!.split(',').filter { it.startsWith("demo-") }.forEach { repository.discard(it) }
                check(prefs.edit().clear().commit())
                expect(!prefs.contains("ids"), "Popup verification starts without leftover synthetic test records")
            }
            "popup-idle" -> {
                check(!prefs.contains("ids")) { "Finish previous popup verification first" }
                val item = record(); val activity = open(item); val started = SystemClock.elapsedRealtime()
                try {
                    expect(item.getLong("autoSaveAt") - item.getLong("receivedAt") == 5000L, "New detected records expose a five-second default popup deadline")
                    expect(find("Payment remarks") == null && find("Choose category") == null, "Compact summary hides optional fields until the user expands it")
                    val bounds = Rect(); find("Show payment details")!!.getBoundsInScreen(bounds)
                    expect(bounds.top > test.targetContext.resources.displayMetrics.heightPixels / 2 && bounds.height() < test.targetContext.resources.displayMetrics.density * 280, "Initial native card is compact and anchored near the bottom")
                    expect((activity as PaymentPromptActivity).paymentWindow.attributes.flags and WindowManager.LayoutParams.FLAG_DIM_BEHIND == 0 && (activity as PaymentPromptActivity).paymentWindow.attributes.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL != 0, "Compact native card leaves the surrounding screen undimmed and non-modal")
                    Thread.sleep(3500)
                    expect(!activity.isFinishing, "An untouched popup remains visible before five seconds")
                    expect(until(3000) { activity.isFinishing } && SystemClock.elapsedRealtime() - started < 6500, "An untouched native popup closes at five seconds without input")
                    val saved = repository.find(item.getString("id"))!!
                    expect(saved.getString("remarks") == "" && saved.getString("expenseCategory") == "uncategorised" && saved.getLong("amountPaise") == 24000L, "No-input timeout retains the original payment without requiring optional metadata")
                } finally { finish(activity) }
            }
            "popup-edit" -> {
                val item = record(); val id = item.getString("id"); val activity = open(item)
                check(prefs.edit().putString("edited", id).commit())
                try {
                    Thread.sleep(1000)
                    swipeUp()
                    expect(find("Collapse payment details") != null, "An upward finger gesture expands the native payment card")
                    expect((activity as PaymentPromptActivity).paymentWindow.attributes.flags and WindowManager.LayoutParams.FLAG_DIM_BEHIND != 0, "Expanded native editor adds a light backdrop")
                    fill("Shared lunch")
                    click("Collapse payment details")
                    expect(find("Payment remarks") == null, "Tapping the header collapses the optional editor")
                    expand()
                    expect(find("Payment remarks")?.text?.toString() == "Shared lunch", "Collapsing and reopening preserves typed native remarks")
                    click("Choose category"); click("Food")
                    expect(until { repository.find(id)?.getString("remarks") == "Shared lunch" && repository.find(id)?.getString("expenseCategory") == "food" }, "Native remarks and category are written to encrypted storage while editing")
                    Thread.sleep(5500)
                    expect(!activity.isFinishing, "Editing extends the native popup beyond the initial five seconds")
                    fill("Shared lunch, my share")
                    Thread.sleep(5500)
                    expect(!activity.isFinishing, "Another edit resets the native countdown to ten seconds from the latest interaction")
                    expect(until(6000) { activity.isFinishing }, "The edited native popup automatically closes after ten idle seconds")
                    val saved = repository.find(id)!!
                    expect(saved.getString("remarks") == "Shared lunch, my share" && saved.getString("expenseCategory") == "food" && saved.getString("category") == "expense", "Automatic dismissal retains the final remarks and expense category")
                } finally { finish(activity) }
            }
            "popup-actions" -> {
                val item = record(); val id = item.getString("id"); var activity = open(item)
                check(prefs.edit().putString("lent", id).commit())
                try {
                    expand()
                    fill("Return next week")
                    click("Choose category")
                    check(until { find("Cancel") != null }) { "Category list did not open" }
                    Thread.sleep(6000)
                    expect(!activity.isFinishing && find("Cancel") != null, "Category selection pauses automatic dismissal while the list is open")
                    // Lent money may be below the dialog viewport on smaller devices.
                    repeat(5) {
                        if (find("Lent money")?.isVisibleToUser != true) {
                            nodes(test.uiAutomation.rootInActiveWindow).filter { it.isScrollable }.forEach { it.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) }
                            Thread.sleep(100)
                        }
                    }
                    click("Lent money")
                    val start = SystemClock.elapsedRealtime(); click("Save")
                    expect(until(3000) { activity.isFinishing } && SystemClock.elapsedRealtime() - start < 3000, "Save immediately commits the native popup and closes before its deadline")
                    expect(repository.find(id)?.getString("category") == "lent" && repository.find(id)?.getString("remarks") == "Return next week", "Popup categories support Lent money and preserve remarks")
                    // Reopening from history/notification must preserve previous optional metadata.
                    activity = open(repository.find(id)!!)
                    expand(); click("Save")
                    expect(until(3000) { activity.isFinishing } && repository.find(id)?.getString("category") == "lent" && repository.find(id)?.getString("remarks") == "Return next week", "Saving a reopened popup without input preserves its existing lending and remarks")
                    val blank = record(); activity = open(blank)
                    expand(); click("Choose category"); click("Groceries"); click("Save")
                    expect(until(3000) { activity.isFinishing } && repository.find(blank.getString("id"))?.getString("remarks") == "" && repository.find(blank.getString("id"))?.getString("expenseCategory") == "groceries", "A category-only popup edit saves successfully with blank remarks")
                    val note = record(); activity = open(note)
                    expand(); fill("Note without category")
                    test.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
                    if (!activity.isFinishing) test.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
                    expect(until(3000) { activity.isFinishing && repository.find(note.getString("id"))?.getString("remarks") == "Note without category" }, "Android Back retains typed remarks even before the debounce deadline")
                } finally { finish(activity) }
            }
            "popup-dismiss" -> {
                val host = test.startActivitySync(Intent(test.targetContext, com.tracemymoney.MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                Thread.sleep(1500)
                val item = record(); var activity = open(item)
                try {
                    Thread.sleep(400)
                    val start = SystemClock.elapsedRealtime()
                    val outsideX = test.targetContext.resources.displayMetrics.widthPixels / 2f
                    val outsideY = test.targetContext.resources.displayMetrics.heightPixels / 3f
                    test.uiAutomation.executeShellCommand("input tap ${outsideX.toInt()} ${outsideY.toInt()}").use {
                        java.io.FileInputStream(it.fileDescriptor).use { stream -> stream.readBytes() }
                    }
                    val closed = until(2000) { activity.isFinishing }; val elapsed = SystemClock.elapsedRealtime() - start
                    check(closed && repository.find(item.getString("id")) != null) { "Outside tap closed=$closed, injection elapsed=${elapsed}ms, flags=${(activity as PaymentPromptActivity).paymentWindow.attributes.flags}" }
                    expect(closed && elapsed < 3000, "Tapping outside closes the compact native card immediately and retains the payment")
                    val next = record(); activity = open(next)
                    Thread.sleep(400)
                    val bounds = Rect(); find("Show payment details")!!.getBoundsInScreen(bounds)
                    val down = SystemClock.uptimeMillis(); val x = bounds.centerX().toFloat(); val y = bounds.top + 20f
                    fun send(action: Int, at: Float) { val motion = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, at, 0); test.sendPointerSync(motion); motion.recycle() }
                    send(MotionEvent.ACTION_DOWN, y)
                    repeat(20) { Thread.sleep(16); send(MotionEvent.ACTION_MOVE, y + (it + 1) * 12f) }
                    send(MotionEvent.ACTION_UP, y + 240f)
                    expect(until(2000) { activity.isFinishing } && repository.find(next.getString("id")) != null, "Swiping the compact card downward dismisses it while keeping the payment saved")
                } finally { finish(activity); finish(host) }
            }
            "popup-verify" -> {
                val edited = repository.find(prefs.getString("edited", "")!!)!!
                val lent = repository.find(prefs.getString("lent", "")!!)!!
                expect(edited.getString("remarks") == "Shared lunch, my share" && edited.getString("expenseCategory") == "food", "Popup auto-saved metadata survives complete process restart")
                expect(lent.getString("category") == "lent" && lent.getString("remarks") == "Return next week", "Popup lending category survives complete process restart")
                val ids = prefs.getString("ids", "")!!.split(',').filter { it.isNotEmpty() }
                ids.forEach { repository.discard(it) }
                expect(ids.all { repository.find(it) == null }, "Popup verification removes only its own synthetic records")
                prefs.edit().clear().commit()
            }
            else -> error("Unknown popup phase")
        }
    }
}
