package com.tracemymoney.ledger

import android.app.Instrumentation
import androidx.room.Room
import org.json.JSONObject

/** Synthetic records only; dispatched by the emulator-guarded runner. */
object ManualVerification {
    fun run(test: Instrumentation, phase: String, repository: LedgerRepository, expect: (Boolean, String) -> Unit) {
        val prefs = test.targetContext.getSharedPreferences("manual.verification", 0)
        if (phase == "manual-verify") {
            val id = prefs.getString("id", null) ?: error("Run manual-prepare first")
            val record = repository.find(id)!!
            expect(record.getLong("amountPaise") == 78734L && record.getString("source") == "manual" && record.getString("method") == "CASH", "Cash amount and manual provenance survive a complete process restart")
            expect(record.getString("remarks") == "Synthetic lunch" && record.getString("expenseCategory") == "food" && record.getLong("transactionAt") == 1768046400000L, "Manual category, remarks and chosen payment time survive restart")
            expect(!record.getBoolean("demo"), "Manual live entries stay separate from sample records")
            repository.update(id, "Example borrower", "lent")
            expect(repository.find(id)!!.getString("category") == "lent" && repository.find(id)!!.getLong("amountPaise") == 78734L, "Manual cash expenses can be marked as lent without changing their amount")
            repository.discard(id)
            expect(repository.find(id) == null, "Manual deletion removes only the synthetic test record")
            prefs.edit().clear().commit()
            return
        }
        check(phase == "manual-prepare" && !prefs.contains("id"))
        val input = JSONObject().put("amount", "787.34").put("method", "CASH")
            .put("recipient", "Example stall").put("remarks", "Synthetic lunch").put("category", "expense")
            .put("expenseCategory", "food").put("occurredAt", 1768046400000L).put("demo", false)
        val before = repository.snapshot().getJSONArray("transactions").length()
        for ((key, value) in listOf("amount" to "0", "amount" to "1.999", "amount" to "100000000.01", "method" to "INVALID", "category" to "INVALID", "expenseCategory" to "INVALID", "occurredAt" to (System.currentTimeMillis() + 60000), "occurredAt" to 1768046400000.5)) {
            var rejected = false
            try { repository.createManual(JSONObject(input.toString()).put(key, value)) }
            catch (_: IllegalArgumentException) { rejected = true }
            expect(rejected && repository.snapshot().getJSONArray("transactions").length() == before, "Invalid manual $key=$value cannot create a partial record")
        }
        val record = repository.createManual(input)
        val id = record.getString("id")
        check(prefs.edit().putString("id", id).commit())
        expect(record.getLong("amountPaise") == 78734L && record.getBoolean("confirmed"), "Manual cash creation saves exact paise immediately without a popup deadline")
        expect(record.isNull("location") && record.getString("locationStatus") == "manual" && record.getString("reference").isEmpty() && record.getString("account").isEmpty(), "Manual records do not invent SMS references, account digits or payment location")
        expect(record.getLong("transactionAt") < record.getLong("receivedAt"), "Payment time is separate from manual creation time")
        val database = Room.databaseBuilder(test.targetContext, LedgerDatabase::class.java, "ledger.db").build()
        try {
            val payload = database.transactions().find(id)!!.payload
            expect(!payload.startsWith("{") && JSONObject(PayloadCipher().decrypt(id, payload)).getString("remarks") == "Synthetic lunch", "Manual amount, notes and method use the existing encrypted ledger")
        } finally { database.close() }
        val cardBody = "Spent Rs.787.34 On HDFC Bank Card 6789b At NJ*bhbjhb POT BHJHBHJ On 87879\nNot You ? To Block + Resedbejb Call....."
        val card = repository.ingest("CP-HDFCBN-S", cardBody, System.currentTimeMillis(), true).getJSONObject("transaction")
        try {
            expect(card.getString("method") == "CARD" && card.getLong("amountPaise") == 78734L && card.getString("recipient") == "NJ*bhbjhb POT BHJHBHJ", "Exact reported HDFC card wording persists the amount, card method and asterisk merchant")
            expect(card.getString("source") == "sms" && card.getString("account").isEmpty() && card.isNull("transactionAt"), "An anonymised invalid card suffix and date are not invented as real data")
        } finally { repository.discard(card.getString("id")) }
    }
}
