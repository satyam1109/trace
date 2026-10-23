package com.tracemymoney.ledger
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

object FinanceUiVerification {
    fun run(test: Instrumentation, repo: LedgerRepository, expect: (Boolean, String) -> Unit) {
        fun nodes(n: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (n == null) emptyList() else listOf(n) + (0 until n.childCount).flatMap { nodes(n.getChild(it)) }
        fun find(label: String): AccessibilityNodeInfo? {
            val matches = nodes(test.uiAutomation.rootInActiveWindow).filter { it.isVisibleToUser && (it.contentDescription?.toString().equals(label,ignoreCase=true) || it.text?.toString().equals(label,ignoreCase=true)) }
            return matches.firstOrNull { it.isClickable || it.isEditable } ?: matches.firstOrNull()
        }
        fun until(timeout: Long = 12000, condition: () -> Boolean): Boolean { val end=SystemClock.elapsedRealtime()+timeout; while(SystemClock.elapsedRealtime()<end){if(condition())return true;Thread.sleep(100)};return false }
        fun click(label:String) { check(until{ if(find(label)==null) nodes(test.uiAutomation.rootInActiveWindow).filter{it.isScrollable}.forEach{it.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)};find(label)!=null}) { "Missing control: $label" }; var n=find(label)!!;repeat(4){if(n.isClickable){check(n.performAction(AccessibilityNodeInfo.ACTION_CLICK));return};n=n.parent?:return@repeat};error("Not clickable: $label") }
        fun fill(label:String,value:String) {
            fun input() = nodes(test.uiAutomation.rootInActiveWindow).firstOrNull { it.isEditable && it.isVisibleToUser && it.contentDescription?.toString().equals(label,ignoreCase=true) }
            check(until{input()!=null}) {"Missing input: $label"}
            check(input()!!.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,Bundle().apply{putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,value)}))
        }
        val original=repo.planning(false).let { JSONObject().put("version",1).put("months",it.optJSONObject("months")?:JSONObject()).put("defaults",it.optJSONObject("defaults")?:JSONObject()).put("categories",it.optJSONArray("categories")?:JSONArray()).put("goals",it.optJSONArray("goals")?:JSONArray()).put("contributions",it.optJSONArray("contributions")?:JSONArray()).put("repayments",it.optJSONArray("repayments")?:JSONArray()) }
        val host=test.startActivitySync(Intent(test.targetContext,com.tracemymoney.MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try {
            check(until(20000){find("Home")!=null}) { "Android React Native interface did not load" }
            click("Home");click("Manage budgets");click("Edit budget");fill("Overall monthly limit","30000");click("Save budget")
            val month=java.text.SimpleDateFormat("yyyy-MM",java.util.Locale.US).format(java.util.Date())
            expect(until{repo.planning(false).optJSONObject("months")?.optJSONObject("INR:$month")?.optLong("budget")==3000000L},"Android budget editor saves through the TurboModule into encrypted Room storage")
            click("Home");click("Savings goals");click("New goal");fill("Goal name","Synthetic UI goal");fill("Goal target amount","80000")
            click("Target date · optional");click("Cancel")
            expect(until { find("Goal name")?.text?.toString()=="Synthetic UI goal" },"Android date-picker cancellation preserves the savings-goal draft")
            click("Save goal")
            expect(until{repo.planning(false).optJSONArray("goals")?.let {a -> (0 until a.length()).any{a.getJSONObject(it).optString("name")=="Synthetic UI goal"}}==true},"Android goal creation persists through the actual React Native bridge")
            click("Home");click("Add");click("Date");click("Cancel");click("Time");click("Cancel")
            expect(until { find("Amount (INR)")?.isEditable==true },"Native date and time pickers return safely to the transaction editor")
            click("Close Add expense")
            expect(until{find("Manage budgets")!=null},"Cancelling a native manual-entry sheet returns to Home")
        } finally { repo.savePlanning(false,original);test.runOnMainSync { if(!host.isFinishing)host.finish() } }
    }
}
