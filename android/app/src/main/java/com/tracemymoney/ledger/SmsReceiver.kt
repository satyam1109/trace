package com.tracemymoney.ledger

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val receivedAt = System.currentTimeMillis()
        val diagnostics = SmsDiagnostics(context)
        val pending = goAsync()
        try {
            val repository = LedgerRepository.get(context)
            repository.executor.execute {
                val processed = try { process(context, intent, repository, receivedAt) }
                    catch (_: Exception) { Processed("processing_error") }
                fun finish() {
                    // Fixed result codes only; no SMS, remarks or coordinates in diagnostics.
                    try { diagnostics.record(receivedAt, processed.outcome) }
                    catch (_: Exception) { }
                    finally { pending.finish() }
                }
                val id = processed.id
                if (id != null && repository.locationEnabled) {
                    // Payment persistence and its prompt happen first. The receiver
                    // remains alive for a bounded location request, without blocking edits.
                    try {
                        PaymentLocation.capture(context, true) { capture ->
                            try {
                                repository.executor.execute {
                                    try { repository.attachLocation(id, capture) }
                                    catch (_: Exception) { }
                                    finally { finish() }
                                }
                            } catch (_: Exception) { finish() }
                        }
                    } catch (_: Exception) { finish() }
                } else finish()
            }
        } catch (_: Exception) {
            try { diagnostics.record(receivedAt, "processing_error") }
            catch (_: Exception) { /* No SMS contents in error logs. */ }
            finally { pending.finish() }
        }
    }

    private data class Processed(val outcome: String, val id: String? = null)
    private fun process(context: Context, intent: Intent, repository: LedgerRepository, receivedAt: Long): Processed {
        if (!repository.detectionEnabled) return Processed("paused")
        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return Processed("unreadable_sms")
        if (parts.isEmpty()) return Processed("unreadable_sms")
        val sender = parts.first().originatingAddress ?: return Processed("unreadable_sms")
        val message = parts.joinToString("") { it.messageBody.orEmpty() }
        val result = repository.ingest(sender, message, receivedAt, false)
        val transaction = result.optJSONObject("transaction")
            ?: return Processed(result.optString("reasonCode", "unsupported_format"))
        if (result.optBoolean("duplicate")) return Processed("duplicate")
        val id = transaction.getString("id")
        return try {
            PaymentNotifications.show(context, id)
            Processed("saved", id)
        } catch (_: Exception) { Processed("saved_prompt_error", id) }
    }
}
