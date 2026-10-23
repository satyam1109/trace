package com.tracemymoney.ledger
import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.tracemymoney.MainActivity
import com.tracemymoney.R
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object BudgetAlerts {
    fun markerKey(currency: String, month: String, category: String, limit: Long): String =
        java.security.MessageDigest.getInstance("SHA-256").digest("$currency:$month:$category:$limit".toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    private const val CHANNEL = "budget_alerts_private_v1"
    fun check(context: Context, state: JSONObject, preferences: JSONObject, transactions: List<JSONObject>) {
        if (!preferences.optBoolean("alerts", true)) return
        val month = SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Budget alerts", NotificationManager.IMPORTANCE_DEFAULT).apply { lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET })
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val markers = context.getSharedPreferences("ledger.budgetAlerts", Context.MODE_PRIVATE)
        for (currency in listOf("INR", "USD", "EUR", "GBP")) {
            val defaults = state.optJSONObject("defaults")?.optJSONObject(currency)?.takeIf { month >= it.optString("from", "9999") }
            val plan = state.optJSONObject("months")?.optJSONObject("$currency:$month") ?: defaults ?: continue
            val expenses = transactions.filter { it.optString("category") == "expense" && it.optString("currency", "INR") == currency && SimpleDateFormat("yyyy-MM", Locale.US).format(Date(if (it.isNull("transactionAt")) it.getLong("receivedAt") else it.getLong("transactionAt"))) == month }
            val limits = plan.optJSONObject("limits") ?: JSONObject()
            val totals = mutableMapOf("overall" to (expenses.sumOf { it.getLong("amountPaise") } to plan.optLong("budget")))
            for (cat in limits.keys()) totals[cat] = expenses.filter { it.optString("expenseCategory") == cat }.sumOf { it.getLong("amountPaise") } to limits.optLong(cat)
            val selected = preferences.optJSONArray("thresholds")
            for ((category, pair) in totals) {
                val (spent, limit) = pair; if (limit <= 0) continue
                val reached = listOf(70, 90, 100).filter { threshold -> (selected == null || (0 until selected.length()).any { selected.optInt(it) == threshold }) && spent * 100 >= limit * threshold }
                val highest = reached.maxOrNull() ?: continue
                val key = markerKey(currency, month, category, limit)
                if (markers.getInt(key, 0) >= highest) continue
                val route = JSONObject().put("screen", "budgets").put("month", month).put("currency", currency).put("category", category)
                val intent = Intent(context, MainActivity::class.java).putExtra("traceRoute", route.toString())
                val pending = PendingIntent.getActivity(context, key.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                manager.notify(key.hashCode(), NotificationCompat.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_payment_notification)
                    .setContentTitle(if (category == "overall") "Monthly budget update" else "Category budget update")
                    .setContentText(if (highest >= 100) "A spending limit has been reached. Tap to review." else "A budget has reached $highest%. Tap to review.")
                    .setVisibility(NotificationCompat.VISIBILITY_SECRET).setContentIntent(pending).setAutoCancel(true).build())
                markers.edit().putInt(key, highest).apply()
            }
        }
    }
}
