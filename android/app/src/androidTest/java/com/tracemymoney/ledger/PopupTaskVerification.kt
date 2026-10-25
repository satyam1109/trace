package com.tracemymoney.ledger

import android.app.Activity
import android.app.Instrumentation
import android.app.NotificationManager
import android.content.Intent
import android.os.SystemClock
import com.tracemymoney.MainActivity
import java.io.FileInputStream

/** Exercises the production notification launcher over other apps, never a real device. */
class PopupTaskVerification(
    private val test: Instrumentation,
    private val repository: LedgerRepository,
    private val expect: (Boolean, String) -> Unit
) {
    private fun shell(command: String): String = test.uiAutomation.executeShellCommand(command).use {
        FileInputStream(it.fileDescriptor).use { stream -> stream.readBytes().toString(Charsets.UTF_8) }
    }
    private fun until(timeout: Long = 3000, condition: () -> Boolean): Boolean {
        val end = SystemClock.elapsedRealtime() + timeout
        while (SystemClock.elapsedRealtime() < end) {
            if (condition()) return true
            Thread.sleep(80)
        }
        return false
    }
    private fun activityBlocks() = shell("dumpsys activity activities").split(Regex("\\* Hist\\s+#\\d+:" )).drop(1)
    private fun visible(packageName: String) = activityBlocks().any {
        it.substringBefore('\n').contains(" $packageName/") && it.contains("mVisibleRequested=true mVisible=true")
    }
    private fun finish(activity: Activity) {
        test.runOnMainSync { if (!activity.isFinishing) activity.finish() }
        check(until { activity.isDestroyed })
    }

    fun run() {
        val priorPreferences = repository.preferences()
        val ids = mutableListOf<String>()
        var host: Activity? = null
        var popup: Activity? = null
        try {
            check(!priorPreferences.optBoolean("appLock", false)) { "Test AVD must have app lock disabled" }
            val home = test.startActivitySync(Intent(test.targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            host = home
            check(until { home.hasWindowFocus() })
            val mainTask = home.taskId
            for ((background, tapNotification) in listOf("settings" to false, "home" to false, "settings" to true)) {
                if (background == "settings") shell("am start -W -a android.settings.SETTINGS") else shell("input keyevent 3")
                val behind = if (background == "settings") "com.android.settings" else "com.android.launcher3"
                check(until { visible(behind) && !visible("com.tracemymoney") }) { "Could not prepare $background background" }
                val item = repository.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 240.00 to Example Cafe via UPI. Ref ${System.nanoTime()}.", System.currentTimeMillis(), true).getJSONObject("transaction")
                val id = item.getString("id"); ids.add(id)
                val monitor = test.addMonitor(PaymentPromptActivity::class.java.name, null, false)
                try {
                    if (tapNotification) {
                        // Skip automatic display to exercise the actual notification PendingIntent.
                        shell("appops set com.tracemymoney SYSTEM_ALERT_WINDOW deny")
                    }
                    PaymentNotifications.show(test.targetContext, id)
                    if (tapNotification) {
                        val alert = test.targetContext.getSystemService(NotificationManager::class.java).activeNotifications.first { it.id == id.hashCode() }
                        shell("appops set com.tracemymoney SYSTEM_ALERT_WINDOW allow")
                        test.runOnMainSync { alert.notification.contentIntent.send() }
                    }
                    popup = monitor.waitForActivityWithTimeout(3000) ?: error("Production payment prompt did not launch")
                    val current = popup!!
                    check(until { (current as PaymentPromptActivity).paymentWindow.decorView.hasWindowFocus() })
                    expect(current.taskId != mainTask, "$background / notification=$tapNotification: popup uses a task separate from Trace homepage")
                    expect(until { visible(behind) }, "$background / notification=$tapNotification: previous screen remains visible behind popup")
                    expect(activityBlocks().filter { it.substringBefore('\n').contains("com.tracemymoney/.MainActivity") }.none { it.contains("mVisibleRequested=true mVisible=true") }, "$background / notification=$tapNotification: Trace homepage stays hidden")
                    if (!tapNotification && background == "settings") {
                        expect(until(6500) { current.isDestroyed }, "Untouched isolated popup still auto-closes after five seconds")
                        popup = null
                    } else { finish(current); popup = null }
                    expect(until { visible(behind) && !visible("com.tracemymoney") }, "$background / notification=$tapNotification: dismissal returns to the previous screen")
                    expect(repository.find(id)?.getLong("amountPaise") == 24000L, "$background / notification=$tapNotification: payment remains saved")
                } finally { test.removeMonitor(monitor) }
            }
            finish(home); host = null
            shell("am start -W -a android.settings.SETTINGS")
            val item = repository.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 1.00 to Cold Example via UPI. Ref ${System.nanoTime()}.", System.currentTimeMillis(), true).getJSONObject("transaction")
            val id = item.getString("id"); ids.add(id)
            val monitor = test.addMonitor(PaymentPromptActivity::class.java.name, null, false)
            try {
                PaymentNotifications.show(test.targetContext, id)
                popup = monitor.waitForActivityWithTimeout(3000) ?: error("Popup without homepage did not launch")
                check(until { (popup as PaymentPromptActivity).paymentWindow.decorView.hasWindowFocus() })
                expect(visible("com.android.settings") && activityBlocks().none { it.substringBefore('\n').contains("com.tracemymoney/.MainActivity") }, "Without a launcher activity, popup leaves Settings visible and never creates a homepage")
                finish(popup!!); popup = null
                expect(until { visible("com.android.settings") }, "Closing the popup without a homepage returns directly to Settings")
            } finally { test.removeMonitor(monitor) }
        } finally {
            popup?.let { finish(it) }; host?.let { finish(it) }
            ids.forEach { PaymentNotifications.cancel(test.targetContext, it); repository.discard(it) }
            shell("appops set com.tracemymoney SYSTEM_ALERT_WINDOW allow")
        }
    }
}
