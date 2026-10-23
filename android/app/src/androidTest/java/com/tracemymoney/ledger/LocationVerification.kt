package com.tracemymoney.ledger

import android.app.Instrumentation
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.os.Bundle
import android.os.SystemClock
import androidx.room.Room
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Only invoked by the synthetic emulator runner; never packaged in the app. */
object LocationVerification {
    fun run(test: Instrumentation, phase: String, reference: String, repository: LedgerRepository, expect: (Boolean, String) -> Unit) {
        val context = test.targetContext
        if (phase == "location-reset") {
            repository.locationEnabled = false
            expect(!repository.locationEnabled, "Location opt-out is stored durably before the app process stops")
            return
        }
        if (phase == "location-enable") {
            repository.locationEnabled = true
            expect(repository.locationEnabled, "Receipt-time location opt-in is durable before cold-start verification")
            return
        }
        if (phase == "location-inspect") {
            val identity = "HDFC Bank|1234|$reference|32100"
            val id = "sms-" + MessageDigest.getInstance("SHA-256").digest(identity.toByteArray()).joinToString("") { "%02x".format(it) }
            try {
                val record = repository.find(id)
                expect(record != null && record.optString("locationStatus") == "captured" && !record.isNull("location"), "A cold-start SMS receiver saves location with no running app process")
                expect(record!!.getJSONObject("location").getString("source") == "sms_receipt" && record.getLong("amountPaise") == 32100L, "Cold-start location remains attached to the correct live SMS payment")
            } finally { repository.discard(id) }
            return
        }
        fun capture(enabled: Boolean): PaymentLocation.Capture {
            val latch = CountDownLatch(1)
            var result: PaymentLocation.Capture? = null
            PaymentLocation.capture(context, enabled) { result = it; latch.countDown() }
            check(latch.await(7, TimeUnit.SECONDS)) { "Location callback exceeded its bounded deadline" }
            return result!!
        }
        if (phase == "location-denied") {
            expect(!repository.locationEnabled, "Location remains disabled after a process restart")
            expect(!PaymentLocation.foregroundGranted(context), "Location starts without an automatic runtime permission grant")
            expect(capture(false).let { it.location == null && it.status == "disabled" }, "Opted-out capture never returns coordinates")
            expect(capture(true).let { it.location == null && it.status == "permission_required" }, "Missing permission returns an explicit status instead of failing payment capture")
            return
        }
        val approximate = phase == "location-approx"
        check(approximate || phase == "location")
        check(PaymentLocation.foregroundGranted(context) && PaymentLocation.backgroundGranted(context)) { "Grant test emulator location permissions first" }
        check(PaymentLocation.preciseGranted(context) != approximate) { "Unexpected test permission granularity" }
        val manager = context.getSystemService(LocationManager::class.java)
        val provider = if (approximate) LocationManager.NETWORK_PROVIDER else LocationManager.GPS_PROVIDER
        val oldLocation = repository.locationEnabled
        val oldDetection = repository.detectionEnabled
        val ids = mutableListOf<String>()
        fun shell(command: String) {
            test.uiAutomation.executeShellCommand(command).use { descriptor ->
                android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { it.readBytes() }
            }
        }
        try {
            @Suppress("DEPRECATION")
            manager.addTestProvider(provider, false, false, false, false, true, true, false,
                Criteria.POWER_LOW, if (approximate) Criteria.ACCURACY_COARSE else Criteria.ACCURACY_FINE)
            manager.setTestProviderEnabled(provider, true)
            val fix = Location(provider).apply {
                latitude = 28.6139; longitude = 77.2090; accuracy = if (approximate) 2000f else 25f
                time = System.currentTimeMillis(); elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
            }
            manager.setTestProviderLocation(provider, fix)
            val result = capture(true)
            expect(result.status == "captured" && result.location != null, "Android location provider supplies a fresh ${if (approximate) "approximate" else "precise"} fix")
            expect(result.location!!.getBoolean("approximate") == approximate && result.location.getString("source") == "sms_receipt", "Location records permission granularity and receipt-time provenance")
            if (approximate) {
                val lat = result.location.getDouble("latitude")
                val lon = result.location.getDouble("longitude")
                expect(kotlin.math.abs(lat * 100 - kotlin.math.round(lat * 100)) < 0.00001 && kotlin.math.abs(lon * 100 - kotlin.math.round(lon * 100)) < 0.00001 && result.location.getDouble("accuracyMeters") >= 1500, "Approximate permission stores rounded coordinates and an approximate accuracy radius")
            }
            val stale = Location(fix).apply { elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos() - 120_000_000_000L }
            val future = Location(fix).apply { elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos() + 120_000_000_000L }
            val invalid = Location(fix).apply { latitude = 150.0 }
            expect(!PaymentLocation.fresh(stale) && !PaymentLocation.fresh(future) && !PaymentLocation.fresh(invalid), "Stale, future and invalid-coordinate fixes are rejected")

            repository.locationEnabled = true
            repository.detectionEnabled = true
            check(reference.matches(Regex("\\d{6,20}")))
            val identity = "HDFC Bank|1234|$reference|32100"
            val id = "sms-" + MessageDigest.getInstance("SHA-256").digest(identity.toByteArray()).joinToString("") { "%02x".format(it) }
            ids.add(id)
            test.sendStatus(0, Bundle().apply { putString("ready", "inject-location-sms") })
            expect(waitUntil { repository.find(id)?.optString("locationStatus") == "captured" }, "A real emulator SMS broadcast attaches location to its saved live payment")
            val saved = repository.find(id)!!
            expect(saved.getLong("amountPaise") == 32100L && !saved.getBoolean("demo") && saved.getJSONObject("location").getBoolean("approximate") == approximate, "Location capture preserves the SMS amount and live-record classification")
            val savedLocation = saved.getJSONObject("location").toString()
            repository.update(id, "Travel friend", "expense", "travel", "Trip to the office\nManual remark")
            val edited = repository.find(id)!!
            expect(edited.getJSONObject("location").toString() == savedLocation && edited.getString("expenseCategory") == "travel" && edited.getString("remarks") == "Trip to the office\nManual remark", "Manual remarks and category edits preserve the captured location")
            val db = Room.databaseBuilder(context, LedgerDatabase::class.java, "ledger.db").build()
            try {
                val payload = db.transactions().find(id)!!.payload
                val decoded = org.json.JSONObject(PayloadCipher().decrypt(id, payload))
                expect(!payload.startsWith("{") && decoded.getJSONObject("location").toString() == savedLocation && decoded.getString("remarks") == edited.getString("remarks"), "Coordinates, remarks and categories persist inside the encrypted payload")
            } finally { db.close() }
            val extra = repository.ingest("VM-HDFCBK", "Your A/c XX1234 debited by INR 1.00 to Example Friend via UPI. Ref ${reference}7.", System.currentTimeMillis(), false).getJSONObject("transaction")
            val extraId = extra.getString("id").also { ids.add(it) }
            repository.locationEnabled = false
            repository.attachLocation(extraId, result)
            expect(repository.find(extraId)!!.let { it.isNull("location") && it.getString("locationStatus") == "disabled" && it.getLong("amountPaise") == 100L }, "Opting out before a callback stores no coordinates and still retains the payment")
            repository.locationEnabled = true
            repository.discard(id)
            repository.attachLocation(id, result)
            expect(repository.find(id) == null, "A delayed location callback cannot recreate a discarded payment")

            shell("cmd location set-location-enabled false")
            check(waitUntil { !PaymentLocation.servicesEnabled(context) })
            expect(capture(true).let { it.location == null && it.status == "services_disabled" }, "Phone location disabled returns a reason without fabricated coordinates")
        } finally {
            ids.forEach { repository.discard(it) }
            repository.locationEnabled = oldLocation
            repository.detectionEnabled = oldDetection
            try { manager.removeTestProvider(provider) } catch (_: Exception) { }
            shell("cmd location set-location-enabled true")
        }
    }

    private fun waitUntil(condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + 20_000
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return true
            Thread.sleep(100)
        }
        return false
    }
}
