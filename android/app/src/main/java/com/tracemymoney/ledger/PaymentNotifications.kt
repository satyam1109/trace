package com.tracemymoney.ledger

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.tracemymoney.MainActivity
import com.tracemymoney.R

object PaymentNotifications {
    private const val CHANNEL = "payment_detection_private_v1"

    fun show(context: Context, id: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Detected payments", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Private alerts for detected bank transaction messages"
                lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET
            })
        }
        val locked = LedgerRepository.get(context).preferences().optBoolean("appLock", false)
        val intent = if (locked) Intent(context, MainActivity::class.java) else PaymentPromptActivity.launchIntent(context, id)
        val pending = PendingIntent.getActivity(context, id.hashCode(), Intent(intent).putExtra("userInitiated", true),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val canNotify = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context,
            Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (canNotify) {
            manager.notify(id.hashCode(), NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_payment_notification)
                .setColor(ContextCompat.getColor(context, R.color.trace_navy))
                .setContentTitle("Payment recorded privately")
                .setContentText("Tap to review your latest transaction.")
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pending).setAutoCancel(true).build())
        }
        if (!locked && Settings.canDrawOverlays(context) && !context.getSystemService(android.app.KeyguardManager::class.java).isKeyguardLocked) {
            Handler(Looper.getMainLooper()).post {
                try { context.startActivity(intent) }
                catch (_: Exception) { /* Notification and saved record remain available. */ }
            }
        }
    }

    fun cancel(context: Context, id: String) {
        context.getSystemService(NotificationManager::class.java).cancel(id.hashCode())
    }
    fun cancelAll(context: Context) { context.getSystemService(NotificationManager::class.java).cancelAll() }
}
