package com.tracemymoney.ledger

import android.app.Instrumentation
import android.content.Intent
import android.graphics.Rect
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/** Real React Native fund navigation and encrypted persistence, synthetic AVD only. */
object QuietUiVerification {
    fun run(test: Instrumentation, repo: LedgerRepository, expect: (Boolean, String) -> Unit) {
        fun nodes(n: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (n == null) emptyList() else listOf(n) + (0 until n.childCount).flatMap { nodes(n.getChild(it)) }
        fun find(label: String): AccessibilityNodeInfo? {
            val matches = nodes(test.uiAutomation.rootInActiveWindow).filter { it.isVisibleToUser && (it.contentDescription?.toString() == label || it.text?.toString() == label) }
            return matches.firstOrNull { it.isClickable || it.isEditable } ?: matches.firstOrNull()
        }
        fun until(timeout: Long = 8000, condition: () -> Boolean): Boolean {
            val end = SystemClock.elapsedRealtime() + timeout
            while (SystemClock.elapsedRealtime() < end) { if (condition()) return true; Thread.sleep(80) }
            return false
        }
        fun locate(label: String): AccessibilityNodeInfo {
            val deadline = SystemClock.elapsedRealtime() + 16000
            var attempt = 0
            while (SystemClock.elapsedRealtime() < deadline) {
                find(label)?.let { return it }
                val direction = if ((attempt++ / 6) % 2 == 0) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                nodes(test.uiAutomation.rootInActiveWindow).filter { it.isScrollable }.forEach { it.performAction(direction) }
                Thread.sleep(180)
            }
            return find(label) ?: error("Missing Quiet control: $label; visible=" + nodes(test.uiAutomation.rootInActiveWindow).filter { it.isVisibleToUser }.mapNotNull { it.contentDescription ?: it.text }.joinToString(" | "))
        }
        fun click(label: String) {
            var node = locate(label)
            repeat(5) { if (node.isClickable) { check(node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { "Click failed: $label" }; Thread.sleep(200); return }; node = node.parent ?: error("Not clickable: $label") }
            error("Not clickable: $label")
        }
        fun fill(label: String, text: String) {
            val node = locate(label)
            check(node.isEditable && node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text) })) { "Input failed: $label" }
        }
        val original = JSONObject(repo.planning(false).toString())
        val goals = JSONArray()
        for ((id, name) in listOf("laptop" to "Quiet Laptop", "holiday" to "Quiet Holiday", "reserve" to "Quiet Reserve")) {
            goals.put(JSONObject().put("id", "quiet-ui-$id").put("name", name).put("target", 8000000).put("currency", "INR").put("due", "").put("icon", "wallet"))
        }
        repo.savePlanning(false, JSONObject().put("version", 1).put("months", JSONObject()).put("defaults", JSONObject()).put("categories", JSONArray()).put("goals", goals).put("contributions", JSONArray()).put("repayments", JSONArray()))
        val host = test.startActivitySync(Intent(test.targetContext, com.tracemymoney.MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try {
            check(until(20000) { find("Home") != null })
            click("Home")
            val folded = Rect(); locate("Expand savings funds").getBoundsInScreen(folded)
            expect(find("Open Quiet Holiday goal") == null, "Folded native fund stack keeps secondary goals out of accessibility focus")
            click("Expand savings funds")
            check(until { find("Open Quiet Laptop goal") != null })
            Thread.sleep(550)
            val opened = Rect(); locate("Open Quiet Laptop goal").getBoundsInScreen(opened)
            expect(opened.height() > folded.height(), "Expanding funds enlarges the top native React Native card")
            click("Open Quiet Holiday goal")
            click("Edit goal"); fill("Goal name", "Quiet Holiday Edited"); fill("Goal target amount", "90000"); click("Save goal")
            expect(until { repo.planning(false).getJSONArray("goals").getJSONObject(1).optString("name") == "Quiet Holiday Edited" }, "A revealed native fund opens the correct goal and edits persist in encrypted storage")
            click("Add contribution"); fill("Contribution amount", "2500"); click("Save contribution")
            expect(until { repo.planning(false).getJSONArray("contributions").let { rows -> rows.length() == 1 && rows.getJSONObject(0).getString("goalId") == "quiet-ui-holiday" && rows.getJSONObject(0).getLong("amount") == 250000L } }, "Native contribution editor allocates money to the selected fund")
            click("Back")
            locate("Open Quiet Holiday Edited goal")
            expect(true, "Returning from a native fund preserves the expanded stack and updated name")
            click("Savings goals")
            locate("Expand savings funds")
            expect(true, "Native funds collapse back into the compact stack")
        } finally {
            repo.savePlanning(false, original)
            test.runOnMainSync { if (!host.isFinishing) host.finish() }
        }
    }
}
