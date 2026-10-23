package com.tracemymoney.ledger

import android.content.Context
import org.json.JSONObject

/** Local receiver health only. Never accepts message text, senders or payment fields. */
class SmsDiagnostics(context: Context) {
    private val prefs = context.getSharedPreferences("ledger.smsDiagnostics", Context.MODE_PRIVATE)

    fun record(receivedAt: Long, result: String) = synchronized(lock) {
        require(result in results)
        // Called on the receiver worker. Finish the small durable write before
        // releasing goAsync(), so a normally killed process retains the result.
        prefs.edit().putLong("receivedCount", prefs.getLong("receivedCount", 0) + 1)
            .putLong("lastReceivedAt", receivedAt).putString("lastResult", result).commit()
        Unit
    }

    fun snapshot(): JSONObject = synchronized(lock) {
        JSONObject().put("receivedCount", prefs.getLong("receivedCount", 0))
            .put("lastReceivedAt", if (prefs.contains("lastReceivedAt")) prefs.getLong("lastReceivedAt", 0) else JSONObject.NULL)
            .put("lastResult", prefs.getString("lastResult", "never_received"))
    }

    fun clear() = synchronized(lock) { prefs.edit().clear().commit(); Unit }

    companion object {
        private val lock = Any()
        private val results = setOf("paused", "unreadable_sms", "unsupported_sender",
            "ignored_message", "unsupported_format", "saved", "duplicate",
            "processing_error", "saved_prompt_error")
    }
}
