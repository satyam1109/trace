package com.tracemymoney.ledger

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class MoneyLedgerModule(context: ReactApplicationContext) : NativeMoneyLedgerSpec(context) {
    private val repository = LedgerRepository.get(context)
    override fun getName() = NAME

    private fun run(promise: Promise, action: () -> Any?) {
        repository.executor.execute {
            try { promise.resolve(action()) }
            catch (e: IllegalArgumentException) { promise.reject("INPUT_ERROR", e.message ?: "Check the entered values.") }
            catch (_: Exception) { promise.reject("LEDGER_ERROR", "Unable to access your local records. Your messages were not uploaded.") }
        }
    }

    override fun createManual(input: String, promise: Promise) = run(promise) {
        repository.createManual(org.json.JSONObject(input)).toString()
    }
    override fun getSnapshot(promise: Promise) = run(promise) {
        val result = repository.snapshot()
        val locked = result.getJSONObject("preferences").optBoolean("appLock", false)
        reactApplicationContext.getCurrentActivity()?.runOnUiThread { reactApplicationContext.getCurrentActivity()?.window?.apply { if (locked) addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE) else clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE) } }
        reactApplicationContext.getCurrentActivity()?.intent?.getStringExtra("traceRoute")?.let { route ->
            result.put("launchRoute", org.json.JSONObject(route)); reactApplicationContext.getCurrentActivity()?.intent?.removeExtra("traceRoute")
        }
        result.toString()
    }
    override fun savePlanningState(demo: Boolean, input: String, promise: Promise) = run(promise) { repository.savePlanning(demo, org.json.JSONObject(input)); null }
    override fun savePreferences(input: String, promise: Promise) = run(promise) {
        repository.savePreferences(org.json.JSONObject(input))
        reactApplicationContext.getCurrentActivity()?.runOnUiThread { reactApplicationContext.getCurrentActivity()?.window?.apply { if (org.json.JSONObject(input).optBoolean("appLock")) addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE) else clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE) } }
        null
    }
    override fun editTransaction(input: String, promise: Promise) = run(promise) { repository.editTransaction(org.json.JSONObject(input)); null }
    override fun resetAllData(promise: Promise) = run(promise) { repository.resetAll(); PaymentNotifications.cancelAll(reactApplicationContext); null }
    override fun authenticate(promise: Promise) { DeviceUnlock.authenticate(reactApplicationContext, reactApplicationContext.getCurrentActivity(), promise) }

    override fun pickDate(initial: String, promise: Promise) {
        val activity = reactApplicationContext.getCurrentActivity() ?: run { promise.reject("PICKER_ERROR", "Open Trace to choose a date."); return }
        activity.runOnUiThread {
            val calendar = java.util.Calendar.getInstance()
            try { val parsed = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { isLenient = false }.parse(initial); if (parsed != null) calendar.time = parsed } catch (_: Exception) { }
            android.app.DatePickerDialog(activity, { _, year, month, day -> promise.resolve(String.format(java.util.Locale.US, "%04d-%02d-%02d", year, month + 1, day)) }, calendar.get(java.util.Calendar.YEAR), calendar.get(java.util.Calendar.MONTH), calendar.get(java.util.Calendar.DAY_OF_MONTH)).apply { setOnCancelListener { promise.resolve("") }; show() }
        }
    }
    override fun pickTime(initial: String, promise: Promise) {
        val activity = reactApplicationContext.getCurrentActivity() ?: run { promise.reject("PICKER_ERROR", "Open Trace to choose a time."); return }
        activity.runOnUiThread {
            val parts = initial.split(":"); val calendar = java.util.Calendar.getInstance()
            val hour = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: calendar.get(java.util.Calendar.HOUR_OF_DAY)
            val minute = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: calendar.get(java.util.Calendar.MINUTE)
            android.app.TimePickerDialog(activity, { _, h, m -> promise.resolve(String.format(java.util.Locale.US, "%02d:%02d", h, m)) }, hour, minute, true).apply { setOnCancelListener { promise.resolve("") }; show() }
        }
    }
    override fun ingestDemo(sender: String, message: String, promise: Promise) = run(promise) {
        repository.ingest(sender, message, System.currentTimeMillis(), true).toString()
    }
    override fun updateTransaction(id: String, recipient: String, category: String, expenseCategory: String, remarks: String, categorySelected: Boolean, promise: Promise) = run(promise) {
        repository.update(id, recipient, category, expenseCategory, remarks, categorySelected); null
    }
    override fun getVendorRules(demo: Boolean, promise: Promise) = run(promise) { repository.vendorRules(demo).toString() }
    override fun editVendorRule(demo: Boolean, key: String, category: String, promise: Promise) = run(promise) { repository.editVendorRule(demo, key, category); null }
    override fun forgetVendorRule(demo: Boolean, key: String, promise: Promise) = run(promise) { repository.forgetVendorRule(demo, key); null }
    override fun clearVendorRules(demo: Boolean, promise: Promise) = run(promise) { repository.clearVendorRules(demo); null }
    override fun discardTransaction(id: String, promise: Promise) = run(promise) {
        repository.discard(id); PaymentNotifications.cancel(reactApplicationContext, id); null
    }
    override fun clearTransactions(demoOnly: Boolean, promise: Promise) = run(promise) {
        repository.clear(demoOnly)
        if (!demoOnly) PaymentNotifications.cancelAll(reactApplicationContext)
        null
    }
    override fun setDetectionEnabled(enabled: Boolean, promise: Promise) = run(promise) {
        repository.detectionEnabled = enabled; null
    }
    override fun setLocationEnabled(enabled: Boolean, promise: Promise) = run(promise) {
        repository.locationEnabled = enabled; null
    }
    override fun openLocationPermissionSettings(promise: Promise) = openSettings(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, true, promise)
    override fun openDeviceLocationSettings(promise: Promise) = openSettings(Settings.ACTION_LOCATION_SOURCE_SETTINGS, false, promise)
    private fun openSettings(action: String, withPackage: Boolean, promise: Promise) {
        try {
            val intent = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (withPackage) intent.data = Uri.parse("package:${reactApplicationContext.packageName}")
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (_: Exception) { promise.reject("SETTINGS_ERROR", "Open Android Settings to manage Trace location access.") }
    }
    override fun openOverlaySettings(promise: Promise) {
        try {
            reactApplicationContext.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactApplicationContext.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve(null)
        } catch (_: Exception) { promise.reject("SETTINGS_ERROR", "Open Android Settings to enable display over other apps.") }
    }

    companion object { const val NAME = "MoneyLedger" }
}
