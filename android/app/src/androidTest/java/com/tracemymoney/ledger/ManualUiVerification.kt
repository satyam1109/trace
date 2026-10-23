package com.tracemymoney.ledger

import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo

/** Exercises the release React Native form and TurboModule, using synthetic data. */
object ManualUiVerification {
    fun run(test: Instrumentation, repository: LedgerRepository, expect: (Boolean, String) -> Unit) {
        fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> {
            if (root == null) return emptyList()
            return listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
        }
        fun find(label: String) = nodes(test.uiAutomation.rootInActiveWindow).firstOrNull {
            it.contentDescription?.toString() == label || it.text?.toString() == label
        }
        fun waitFor(condition: () -> Boolean): Boolean {
            val end = System.currentTimeMillis() + 15000
            while (System.currentTimeMillis() < end) {
                if (condition()) return true
                Thread.sleep(150)
            }
            return false
        }
        fun click(label: String) {
            check(waitFor { find(label) != null }) { "Missing UI control: $label" }
            check(find(label)!!.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { "Could not click $label" }
        }
        fun fill(label: String, value: String) {
            fun editable() = nodes(test.uiAutomation.rootInActiveWindow).firstOrNull { it.isEditable && it.contentDescription?.toString() == label }
            check(waitFor { editable() != null }) { "Missing UI input: $label" }
            check(editable()!!.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
            })) { "Could not fill $label" }
        }
        val before = repository.snapshot().getJSONArray("transactions").let { list -> (0 until list.length()).map { list.getJSONObject(it).getString("id") }.toSet() }
        test.targetContext.startActivity(Intent().setClassName(test.targetContext.packageName, test.targetContext.packageName + ".MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try {
            click("Add")
            fill("Amount (INR)", "12.35")
            fill("Recipient · optional", "Synthetic manual UI")
            // Scroll the form to its submit control using Android accessibility.
            repeat(8) {
                if (find("Save expense")?.isVisibleToUser != true) {
                    nodes(test.uiAutomation.rootInActiveWindow).filter { it.isScrollable }.forEach {
                        it.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                    }
                    Thread.sleep(150)
                }
            }
            click("Save expense")
            var created: org.json.JSONObject? = null
            expect(waitFor {
                val records = repository.snapshot().getJSONArray("transactions")
                created = (0 until records.length()).map { records.getJSONObject(it) }.firstOrNull { it.getString("id") !in before && it.optString("recipient") == "Synthetic manual UI" }
                created != null
            }, "Release Android Create form saves through the real React Native TurboModule")
            val record = created!!
            expect(record.getLong("amountPaise") == 1235L && record.getString("method") == "CASH" && record.getString("source") == "manual" && !record.getBoolean("demo"), "Android manual form saves a live cash expense with exact paise and provenance")
            expect(waitFor { find("Add expense") == null && find("History") != null }, "Successful Android manual creation closes the form and returns to history")
        } finally {
            val records = repository.snapshot().getJSONArray("transactions")
            (0 until records.length()).map { records.getJSONObject(it) }.filter { it.getString("id") !in before && it.optString("recipient") == "Synthetic manual UI" }.forEach { repository.discard(it.getString("id")) }
        }
    }
}
