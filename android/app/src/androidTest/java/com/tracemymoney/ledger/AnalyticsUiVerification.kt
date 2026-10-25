package com.tracemymoney.ledger

import android.app.Instrumentation
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo

object AnalyticsUiVerification {
    fun run(test: Instrumentation, expect: (Boolean, String) -> Unit) {
        fun nodes(n: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (n == null) emptyList() else listOf(n) + (0 until n.childCount).flatMap { nodes(n.getChild(it)) }
        fun all() = nodes(test.uiAutomation.rootInActiveWindow)
        fun find(label: String): AccessibilityNodeInfo? {
            val matches = all().filter { it.isVisibleToUser && (it.text?.toString().equals(label,true) || it.contentDescription?.toString().equals(label,true)) }
            return matches.firstOrNull { it.isClickable || it.isEditable } ?: matches.firstOrNull()
        }
        fun until(condition: () -> Boolean): Boolean {
            val end=SystemClock.elapsedRealtime()+15000
            while(SystemClock.elapsedRealtime()<end) { if(condition()) return true; Thread.sleep(100) };return false
        }
        fun click(label:String) {
            check(until { if(find(label)==null) all().filter{it.isVisibleToUser&&it.isScrollable}.forEach{it.performAction(if(label in setOf("Overview","Categories","Compare","Choose analytics date range")) AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD else AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)};find(label)!=null }) {"Missing control: $label"}
            var node=find(label)!!
            while(!node.isClickable) node=node.parent?:error("Not clickable: $label")
            check(node.performAction(AccessibilityNodeInfo.ACTION_CLICK))
        }
        val activity=test.startActivitySync(Intent(test.targetContext,com.tracemymoney.MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try {
            check(until{find("Analytics")!=null}) {"React Native interface did not load"}
            click("Analytics")
            expect(until{find("Overview")!=null&&find("Categories")!=null&&find("Compare")!=null},"Android Analytics exposes Overview, Categories and Compare tabs")
            expect(until{find("Spending in selected range")!=null},"Native Overview renders the recorded-spending total")
            click("Categories")
            expect(until{find("Where your money went")!=null},"Native Categories renders the category view")
            click("Compare")
            expect(until{find("Choose spending month")!=null&&find("Choose comparison month")!=null},"Native Compare exposes independent target and full-month selectors")
            click("Choose comparison month")
            expect(until{find("Close Comparison month")!=null},"Native comparison month selector opens safely")
            click("Close Comparison month")
            click("Income & surplus")
            expect(until{find("Recorded surplus")!=null||find("Income not recorded")!=null||find("Recorded deficit")!=null},"Android income disclosure distinguishes unrecorded income from surplus")
            click("Overview")
            click("Choose analytics date range")
            click("Analytics from date (YYYY-MM-DD)")
            click("Cancel")
            expect(until{find("Apply date range")!=null},"Native date-picker cancellation preserves the analytics range editor")
            click("Close Date range")
            expect(until{find("Close Date range")==null && find("Analytics")!=null},"Closing the native range editor restores app navigation")
        } finally { test.runOnMainSync { if(!activity.isFinishing) activity.finish() } }
    }
}
