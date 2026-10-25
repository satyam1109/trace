package com.tracemymoney.ledger

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors

class LedgerRepository private constructor(private val context: Context) {
    val executor = Executors.newSingleThreadExecutor()
    private val db = Room.databaseBuilder(context, LedgerDatabase::class.java, "ledger.db")
        .addMigrations(MIGRATION_1_2, MIGRATION_2_3).build()
    private val cipher = PayloadCipher()
    private val prefs = context.getSharedPreferences("ledger.settings", Context.MODE_PRIVATE)
    var detectionEnabled: Boolean
        get() = prefs.getBoolean("detectionEnabled", false)
        set(value) { prefs.edit().putBoolean("detectionEnabled", value).apply() }
    var locationEnabled: Boolean
        get() = prefs.getBoolean("locationEnabled", false)
        set(value) { check(prefs.edit().putBoolean("locationEnabled", value).commit()) { "Could not save location preference" } }

    private val expenseCategories = setOf("uncategorised", "food", "clothes", "groceries", "travel", "bills", "health", "entertainment", "other")

    fun find(id: String): JSONObject? = db.transactions().find(id)?.let {
        withCategory(JSONObject(cipher.decrypt(it.id, it.payload)))
    }

    // Older encrypted payloads have no category. Read them without changing the
    // Room schema or discarding existing data; persist the category on next edit.
    private fun withCategory(transaction: JSONObject): JSONObject = transaction.apply {
        if (optString("source") != "manual") put("source", "sms")
        if (optString("category") !in setOf("expense", "lent", "income", "transfer")) put("category", "expense")
        if (!has("currency")) put("currency", "INR")
        if (!validCategory(optString("expenseCategory"))) put("expenseCategory", "uncategorised")
        if (!has("remarks") || isNull("remarks")) put("remarks", "")
        if (!has("locationStatus")) put("locationStatus", if (optBoolean("demo")) "sample" else "not_recorded")
    }

    fun ingest(sender: String, body: String, receivedAt: Long, demo: Boolean): JSONObject {
        val result = TransactionParser.inspect(sender, body)
        val payment = result.payment
            ?: return JSONObject().put("transaction", JSONObject.NULL).put("duplicate", false)
                .put("reasonCode", result.reasonCode)
                .put("reason", "No supported successful debit found. OTPs, credits and unsupported messages are ignored.")
        // Reference-less messages deduplicate only exact content within a narrow time bucket.
        // This intentionally avoids merging separate equal-amount payments.
        val identity = if (payment.reference.isNotEmpty()) {
            "${payment.bank}|${payment.account}|${payment.reference}|${payment.amountPaise}"
        } else { "$sender|$body|${receivedAt / 60_000}" }
        val hash = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray())
            .joinToString("") { "%02x".format(it) }
        val id = if (demo) "demo-${UUID.randomUUID()}" else "sms-$hash"
        find(id)?.let { return JSONObject().put("transaction", it).put("duplicate", true).put("reason", "Already recorded") }
        val remembered = vendorCategory(payment.recipient, demo)
        val transaction = JSONObject()
            .put("id", id).put("source", "sms").put("currency", "INR").put("amountPaise", payment.amountPaise)
            .put("bank", payment.bank).put("account", payment.account)
            .put("method", payment.method).put("recipient", payment.recipient).put("vendorName", payment.recipient)
            .put("category", "expense")
            .put("expenseCategory", remembered ?: "uncategorised").put("categorySource", if (remembered != null) "vendor" else "uncategorised").put("remarks", "")
            .put("reference", payment.reference).put("receivedAt", receivedAt)
            .put("transactionAt", JSONObject.NULL).put("autoSaveAt", receivedAt + 5_000)
            .put("confirmed", false).put("demo", demo).put("location", JSONObject.NULL)
            .put("locationStatus", if (demo) "sample" else if (locationEnabled) "pending" else "disabled")
        val stored = StoredTransaction().apply {
            this.id = id; this.receivedAt = receivedAt; this.demo = demo
            payload = cipher.encrypt(id, transaction.toString())
        }
        val inserted = db.transactions().insert(stored) != -1L
        if (inserted && !demo) checkBudgets()
        return JSONObject().put("transaction", transaction).put("duplicate", !inserted).put("reason", "")
    }

    fun createManual(input: JSONObject): JSONObject {
        val amount = input.getString("amount").trim()
        require(Regex("^[0-9]{1,9}(?:\\.[0-9]{1,2})?$").matches(amount)) { "Enter an amount with up to two decimal places" }
        val paise = BigDecimal(amount).multiply(BigDecimal(100)).longValueExact()
        require(paise in 1..10_000_000_000L) { "Amount out of range" }
        val method = input.getString("method")
        require(method in setOf("CASH", "UPI", "CARD", "DEBIT_CARD", "CREDIT_CARD", "BANK")) { "Unsupported payment method" }
        val category = input.getString("category")
        require(category in setOf("expense", "lent", "income", "transfer")) { "Unsupported category" }
        val expenseCategory = input.getString("expenseCategory")
        require(validCategory(expenseCategory)) { "Unsupported expense category" }
        val date = input.getDouble("occurredAt")
        val now = System.currentTimeMillis()
        require(date.isFinite() && date == kotlin.math.floor(date) && date >= 946684800000L && date <= now) { "Choose a past or current payment time" }
        val id = "manual-${UUID.randomUUID()}"
        val demo = input.getBoolean("demo")
        require(input.optString("currency", "INR") in setOf("INR", "USD", "EUR", "GBP")) { "Unsupported currency" }
        val transaction = JSONObject().put("id", id).put("source", "manual").put("currency", input.optString("currency", "INR")).put("amountPaise", paise)
            .put("bank", "Manual entry").put("account", "").put("reference", "").put("method", method)
            .put("recipient", input.getString("recipient").trim().take(100))
            .put("category", category).put("expenseCategory", expenseCategory)
            .put("remarks", input.getString("remarks").trim().take(500))
            .put("receivedAt", now).put("transactionAt", date.toLong()).put("autoSaveAt", now)
            .put("confirmed", true).put("demo", demo).put("location", JSONObject.NULL).put("locationStatus", "manual")
        val remembered = if (category == "expense" && !input.optBoolean("categorySelected")) vendorCategory(transaction.getString("recipient"), demo) else null
        if (remembered != null) transaction.put("expenseCategory", remembered).put("categorySource", "vendor")
        db.runInTransaction {
            learnVendor(transaction, input.optBoolean("categorySelected"))
            val inserted = db.transactions().insert(StoredTransaction().apply {
                this.id = id; receivedAt = now; this.demo = demo
                payload = cipher.encrypt(id, transaction.toString())
            })
            check(inserted != -1L) { "Could not save expense" }
        }
        require(transaction.getString("currency") in setOf("INR", "USD", "EUR", "GBP")) { "Unsupported currency" }
        if (!demo) checkBudgets()
        return transaction
    }

    fun update(id: String, recipient: String, category: String? = null, expenseCategory: String? = null, remarks: String? = null, categorySelected: Boolean = false) {
        require(category == null || category in setOf("expense", "lent", "income", "transfer")) { "Unsupported category" }
        require(expenseCategory == null || validCategory(expenseCategory)) { "Unsupported expense category" }
        val transaction = find(id) ?: return
        preserveVendorName(transaction)
        transaction.put("recipient", recipient.trim().take(100)).put("confirmed", true)
        // A native SMS popup edits only the recipient and must preserve lending.
        if (category != null) transaction.put("category", category)
        if (expenseCategory != null) transaction.put("expenseCategory", expenseCategory)
        if (remarks != null) transaction.put("remarks", remarks.trim().take(500))
        db.runInTransaction {
            learnVendor(transaction, categorySelected)
            db.transactions().update(id, cipher.encrypt(id, transaction.toString()))
        }
        if (!transaction.optBoolean("demo")) checkBudgets()
    }

    fun attachLocation(id: String, capture: PaymentLocation.Capture) {
        val transaction = find(id) ?: return // A late callback must never recreate a discarded record.
        if (transaction.optBoolean("demo") || transaction.optString("source") == "manual" || !transaction.isNull("location")) return
        val allowed = locationEnabled && PaymentLocation.foregroundGranted(context) && PaymentLocation.backgroundGranted(context)
        val location = if (allowed) capture.location?.let { JSONObject(it.toString()) } else null
        if (location != null && !PaymentLocation.preciseGranted(context)) {
            location.put("latitude", kotlin.math.round(location.getDouble("latitude") * 100) / 100)
                .put("longitude", kotlin.math.round(location.getDouble("longitude") * 100) / 100)
                .put("accuracyMeters", maxOf(1500.0, location.getDouble("accuracyMeters"))).put("approximate", true)
        }
        transaction.put("location", location ?: JSONObject.NULL)
            .put("locationStatus", if (!locationEnabled) "disabled" else if (!allowed) "permission_required" else capture.status)
        db.transactions().update(id, cipher.encrypt(id, transaction.toString()))
    }

    fun discard(id: String) {
        val record = find(id) ?: return
        db.runInTransaction {
            val state = planning(record.optBoolean("demo"))
            val kept = JSONArray()
            val repayments = state.optJSONArray("repayments") ?: JSONArray()
            for (i in 0 until repayments.length()) if (repayments.getJSONObject(i).optString("transactionId") != id) kept.put(repayments.getJSONObject(i))
            state.put("repayments", kept)
            writeDocument(if (record.optBoolean("demo")) "finance.demo" else "finance.live", state)
            db.transactions().delete(id)
        }
    }
    fun clear(demoOnly: Boolean) {
        if (demoOnly) db.transactions().clearDemo()
        else { db.transactions().clear(); SmsDiagnostics(context).clear() }
        for (demo in if (demoOnly) listOf(true) else listOf(false, true)) {
            val value = planning(demo).put("repayments", JSONArray())
            writeDocument(if (demo) "finance.demo" else "finance.live", value)
        }
    }

    fun snapshot(): JSONObject {
        val transactions = JSONArray()
        db.transactions().all().forEach { stored ->
            transactions.put(withCategory(JSONObject(cipher.decrypt(stored.id, stored.payload))))
        }
        return JSONObject().put("planning", JSONObject().put("live", planning(false)).put("demo", planning(true))).put("preferences", preferences()).put("transactions", transactions)
            .put("detectionEnabled", detectionEnabled)
            .put("smsGranted", ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED)
            .put("notificationsGranted", Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            .put("overlayGranted", Settings.canDrawOverlays(context))
            .put("nativeAvailable", true)
            .put("locationEnabled", locationEnabled)
            .put("locationForegroundGranted", PaymentLocation.foregroundGranted(context))
            .put("locationBackgroundGranted", PaymentLocation.backgroundGranted(context))
            .put("locationServicesEnabled", PaymentLocation.servicesEnabled(context))
            .put("smsDiagnostics", SmsDiagnostics(context).snapshot())
    }

    private fun validCategory(value: String) = value in expenseCategories || Regex("^(custom_[a-z0-9_-]{1,64}|income_(salary|freelance|other))$").matches(value)

    private fun readDocument(key: String): JSONObject = db.planning().find(key)?.let { JSONObject(cipher.decrypt(key, it.payload)) } ?: JSONObject()
    private fun writeDocument(key: String, value: JSONObject) {
        db.planning().save(StoredPlan().apply { this.key = key; payload = cipher.encrypt(key, value.toString()) })
    }
    fun planning(demo: Boolean) = readDocument(if (demo) "finance.demo" else "finance.live")
    fun preferences() = readDocument("preferences")
    fun savePreferences(value: JSONObject) {
        require(value.optString("theme") in setOf("system", "light", "dark")) { "Unsupported theme" }
        require(value.optString("currency") in setOf("INR", "USD", "EUR", "GBP")) { "Unsupported currency" }
        require(value.optString("name").length <= 60) { "Name is too long" }
        val thresholds = value.getJSONArray("thresholds")
        for (i in 0 until thresholds.length()) require(thresholds.getInt(i) in setOf(70, 90, 100))
        writeDocument("preferences", value)
        checkBudgets()
    }
    fun savePlanning(demo: Boolean, value: JSONObject) {
        require(value.optInt("version") == 1) { "Unsupported planning data" }
        fun money(value: Any, zero: Boolean = true) {
            require(value is Number) { "Enter a valid amount" }
            val number = value.toDouble()
            require(number.isFinite() && number == kotlin.math.floor(number) && number >= (if (zero) 0.0 else 1.0) && number <= 10_000_000_000.0) { "Amount out of range" }
        }
        val months = value.getJSONObject("months")
        for (key in months.keys()) { require(Regex("^(INR|USD|EUR|GBP):[0-9]{4}-(0[1-9]|1[0-2])$").matches(key)); val month = months.getJSONObject(key)
            if (!month.isNull("budget")) money(month.get("budget"))
            if (!month.isNull("savingsTarget")) money(month.get("savingsTarget"))
            val limits = month.getJSONObject("limits"); for (cat in limits.keys()) { require(validCategory(cat)); money(limits.getLong(cat)) }
        }
        val defaults = value.getJSONObject("defaults")
        for (currency in defaults.keys()) { require(currency in setOf("INR", "USD", "EUR", "GBP")); val d = defaults.getJSONObject(currency)
            require(Regex("^[0-9]{4}-(0[1-9]|1[0-2])$").matches(d.getString("from")))
            if (!d.isNull("budget")) money(d.get("budget")); if (!d.isNull("savingsTarget")) money(d.get("savingsTarget"))
            val limits = d.getJSONObject("limits"); for (cat in limits.keys()) { require(validCategory(cat)); money(limits.getLong(cat)) }
        }
        val categories = value.getJSONArray("categories"); val categoryIds = mutableSetOf<String>()
        for (i in 0 until categories.length()) { val c = categories.getJSONObject(i); require(c.getString("id").startsWith("custom_") && validCategory(c.getString("id"))); require(categoryIds.add(c.getString("id"))); require(c.getString("name").trim().length in 1..40); require(Regex("^#[0-9a-fA-F]{6}$").matches(c.getString("color"))) }
        val goals = value.getJSONArray("goals"); val goalIds = mutableSetOf<String>()
        for (i in 0 until goals.length()) { val g = goals.getJSONObject(i); require(goalIds.add(g.getString("id"))); require(g.getString("name").trim().length in 1..60); money(g.get("target"), false); require(g.getString("currency") in setOf("INR", "USD", "EUR", "GBP")) }
        val contributions = value.getJSONArray("contributions"); val contributionIds = mutableSetOf<String>()
        for (i in 0 until contributions.length()) { val c = contributions.getJSONObject(i); require(contributionIds.add(c.getString("id"))); require(c.getString("goalId") in goalIds); money(c.get("amount"), false); require(c.getLong("at") in 946684800000L..System.currentTimeMillis()) }
        val repayments = value.getJSONArray("repayments"); val totals = mutableMapOf<String, Long>(); val repaymentIds = mutableSetOf<String>()
        for (i in 0 until repayments.length()) { val r = repayments.getJSONObject(i); require(repaymentIds.add(r.getString("id"))); val txId = r.getString("transactionId"); val tx = find(txId) ?: throw IllegalArgumentException("Lending entry no longer exists")
            require(tx.getString("category") == "lent" && tx.optBoolean("demo") == demo); money(r.get("amount"), false)
            require(r.getLong("at") in tx.optLong("transactionAt", tx.getLong("receivedAt"))..System.currentTimeMillis())
            totals[txId] = (totals[txId] ?: 0L) + r.getLong("amount"); require(totals.getValue(txId) <= tx.getLong("amountPaise")) { "Repayment exceeds outstanding amount" }
        }
        db.runInTransaction {
            writeDocument(if (demo) "finance.demo" else "finance.live", value)
            // Category removal invalidates its rules without rewriting history.
            for (rule in db.vendors().all(demo)) {
                val data = JSONObject(cipher.decrypt(rule.key, rule.payload))
                if (!rememberableCategory(data.optString("category"), demo)) db.vendors().delete(rule.key, demo)
            }
        }
        if (!demo) checkBudgets()
    }
    fun editTransaction(input: JSONObject) {
        val id = input.getString("id"); val tx = find(id) ?: throw IllegalArgumentException("Entry no longer exists")
        val amount = input.getLong("amountPaise"); require(input.getDouble("amountPaise").isFinite() && input.getDouble("amountPaise") == amount.toDouble() && amount in 1..10_000_000_000L)
        val category = input.getString("category"); require(category in setOf("expense", "income", "lent", "transfer"))
        val method = input.getString("method"); require(method in setOf("UPI", "CASH", "CARD", "DEBIT_CARD", "CREDIT_CARD", "BANK"))
        val expenseCategory = input.getString("expenseCategory"); require(validCategory(expenseCategory))
        val at = input.getLong("transactionAt"); require(at in 946684800000L..System.currentTimeMillis())
        val repayments = planning(tx.optBoolean("demo")).optJSONArray("repayments") ?: JSONArray()
        var repaid = 0L; for (i in 0 until repayments.length()) { val r = repayments.getJSONObject(i); if (r.getString("transactionId") == id) { repaid += r.getLong("amount"); require(at <= r.getLong("at")) { "Payment date cannot follow a repayment" } } }
        require(repaid == 0L || (category == "lent" && amount >= repaid)) { "Keep this as lending with at least the repaid amount" }
        preserveVendorName(tx)
        tx.put("amountPaise", amount).put("category", category).put("expenseCategory", expenseCategory).put("method", method).put("transactionAt", at)
            .put("recipient", input.getString("recipient").trim().take(100)).put("remarks", input.getString("remarks").trim().take(500)).put("confirmed", true)
        db.runInTransaction {
            learnVendor(tx, input.optBoolean("categorySelected"))
            db.transactions().update(id, cipher.encrypt(id, tx.toString()))
        }
        if (!tx.optBoolean("demo")) checkBudgets()
    }
    private fun preserveVendorName(tx: JSONObject) {
        // Display-name edits must not change the identity extracted from an SMS.
        if (tx.optString("source") != "manual" && !tx.has("vendorName")) tx.put("vendorName", tx.optString("recipient"))
    }
    private fun rememberableCategory(category: String, demo: Boolean): Boolean {
        if (category in expenseCategories && category != "uncategorised") return true
        if (!category.startsWith("custom_")) return false
        val custom = planning(demo).optJSONArray("categories") ?: return false
        return (0 until custom.length()).any { custom.getJSONObject(it).optString("id") == category }
    }
    private fun vendorCategory(name: String, demo: Boolean): String? {
        return try {
            val normal = VendorIdentity.normalise(name)
            if (normal.isEmpty()) return null
            val key = cipher.vendorKey(normal, demo)
            val stored = db.vendors().find(key) ?: return null
            val category = JSONObject(cipher.decrypt(key, stored.payload)).getString("category")
            category.takeIf { rememberableCategory(it, demo) }
        } catch (_: Exception) {
            // A damaged optional rule must not prevent the payment from being saved.
            android.util.Log.w("Trace", "Vendor category unavailable")
            null
        }
    }
    private fun learnVendor(tx: JSONObject, selected: Boolean) {
        if (!selected || tx.optString("category") != "expense") return
        val demo = tx.optBoolean("demo")
        val category = tx.optString("expenseCategory")
        if (!rememberableCategory(category, demo)) return
        val name = if (tx.optString("source") == "manual") tx.optString("recipient") else tx.optString("vendorName", tx.optString("recipient"))
        val normal = VendorIdentity.normalise(name)
        if (normal.isEmpty()) return
        val key = cipher.vendorKey(normal, demo)
        db.vendors().save(StoredVendor().apply {
            this.key = key; this.demo = demo
            payload = cipher.encrypt(key, JSONObject().put("name", name.trim().take(100)).put("category", category).toString())
        })
        tx.put("categorySource", "manual")
    }
    fun vendorRules(demo: Boolean): JSONArray = JSONArray().apply {
        db.vendors().all(demo).forEach { put(JSONObject(cipher.decrypt(it.key, it.payload)).put("key", it.key)) }
    }
    fun editVendorRule(demo: Boolean, key: String, category: String) {
        require(rememberableCategory(category, demo)) { "Choose an existing expense category" }
        val rule = db.vendors().find(key)?.takeIf { it.demo == demo } ?: throw IllegalArgumentException("Vendor rule no longer exists")
        val value = JSONObject(cipher.decrypt(key, rule.payload)).put("category", category)
        rule.payload = cipher.encrypt(key, value.toString()); db.vendors().save(rule)
    }
    fun forgetVendorRule(demo: Boolean, key: String) { db.vendors().delete(key, demo) }
    fun clearVendorRules(demo: Boolean) { db.vendors().clearWorkspace(demo) }
    fun checkBudgets() {
        // Optional alerts must never interrupt payment capture or its popup.
        try { BudgetAlerts.check(context, planning(false), preferences(), snapshotTransactions()) }
        catch (_: Exception) { android.util.Log.w("Trace", "Budget alert check unavailable") }
    }
    private fun snapshotTransactions(): List<JSONObject> = db.transactions().all().filter { !it.demo }.map { withCategory(JSONObject(cipher.decrypt(it.id, it.payload))) }
    fun resetAll() { db.runInTransaction { db.transactions().clear(); db.planning().clear(); db.vendors().clear() }; prefs.edit().clear().commit(); SmsDiagnostics(context).clear(); context.getSharedPreferences("ledger.budgetAlerts", Context.MODE_PRIVATE).edit().clear().commit() }

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("CREATE TABLE IF NOT EXISTS `planning` (`key` TEXT NOT NULL, `payload` TEXT NOT NULL, PRIMARY KEY(`key`))")
            }
        }
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("CREATE TABLE IF NOT EXISTS `vendor_rules` (`key` TEXT NOT NULL, `demo` INTEGER NOT NULL, `payload` TEXT NOT NULL, PRIMARY KEY(`key`))")
            }
        }
        @Volatile private var instance: LedgerRepository? = null
        fun get(context: Context): LedgerRepository = instance ?: synchronized(this) {
            instance ?: LedgerRepository(context.applicationContext).also { instance = it }
        }
    }
}
