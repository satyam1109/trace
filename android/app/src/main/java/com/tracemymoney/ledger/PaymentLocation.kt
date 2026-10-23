package com.tracemymoney.ledger

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/** One bounded fix per saved live SMS, never a continuous location subscription. */
object PaymentLocation {
    data class Capture(val location: JSONObject?, val status: String)
    private val main = Handler(Looper.getMainLooper())
    private const val MAX_FIX_AGE_MS = 30_000L
    private const val TIMEOUT_MS = 5_000L

    fun foregroundGranted(context: Context) = granted(context, Manifest.permission.ACCESS_COARSE_LOCATION) || preciseGranted(context)
    fun preciseGranted(context: Context) = granted(context, Manifest.permission.ACCESS_FINE_LOCATION)
    fun backgroundGranted(context: Context) = Build.VERSION.SDK_INT < 29 || granted(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    private fun granted(context: Context, permission: String) = ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    fun servicesEnabled(context: Context): Boolean = try {
        LocationManagerCompat.isLocationEnabled(context.getSystemService(LocationManager::class.java))
    } catch (_: Exception) { false }

    fun capture(context: Context, enabled: Boolean, complete: (Capture) -> Unit) {
        main.post { captureOnMain(context.applicationContext, enabled, complete) }
    }

    @SuppressLint("MissingPermission") // All provider access is guarded, including after permission revocation.
    private fun captureOnMain(context: Context, enabled: Boolean, complete: (Capture) -> Unit) {
        if (!enabled) { complete(Capture(null, "disabled")); return }
        if (!foregroundGranted(context) || !backgroundGranted(context)) { complete(Capture(null, "permission_required")); return }
        if (!servicesEnabled(context)) { complete(Capture(null, "services_disabled")); return }
        val manager = context.getSystemService(LocationManager::class.java)
        val precise = preciseGranted(context)
        val signals = mutableListOf<CancellationSignal>()
        val finished = AtomicBoolean(false)
        var timeout: Runnable? = null
        fun finish(location: Location?, status: String) {
            if (!finished.compareAndSet(false, true)) return
            timeout?.let { main.removeCallbacks(it) }
            signals.forEach { try { it.cancel() } catch (_: Exception) { } }
            val accepted = location?.takeIf { fresh(it) }
            val payload = accepted?.let {
                val retainPrecision = precise && preciseGranted(context)
                JSONObject().put("latitude", if (retainPrecision) it.latitude else kotlin.math.round(it.latitude * 100) / 100)
                    .put("longitude", if (retainPrecision) it.longitude else kotlin.math.round(it.longitude * 100) / 100)
                    .put("accuracyMeters", if (retainPrecision) it.accuracy.toDouble() else maxOf(1500.0, it.accuracy.toDouble())).put("fixAt", it.time)
                    .put("capturedAt", System.currentTimeMillis()).put("approximate", !retainPrecision)
                    .put("source", "sms_receipt")
            }
            complete(Capture(payload, if (payload != null) "captured" else status))
        }
        try {
            val providers = manager.getProviders(true).filter {
                it == LocationManager.NETWORK_PROVIDER || it == "fused" || (precise && it == LocationManager.GPS_PROVIDER)
            }
            if (providers.isEmpty()) { finish(null, "unavailable"); return }
            val recent = providers.mapNotNull { manager.getLastKnownLocation(it) }.filter { fresh(it) }
                .minByOrNull { it.accuracy }
            if (recent != null) { finish(recent, "unavailable"); return }
            var pending = providers.size
            timeout = Runnable { finish(null, "unavailable") }
            main.postDelayed(timeout!!, TIMEOUT_MS)
            providers.forEach { provider ->
                if (!finished.get()) {
                    val signal = CancellationSignal().also { signals.add(it) }
                    LocationManagerCompat.getCurrentLocation(manager, provider, signal, ContextCompat.getMainExecutor(context)) { location ->
                        if (location != null && fresh(location)) finish(location, "unavailable")
                        else if (--pending == 0) finish(null, "unavailable")
                    }
                }
            }
        } catch (_: SecurityException) { finish(null, "permission_required") }
        catch (_: Exception) { finish(null, "unavailable") }
    }

    fun fresh(location: Location): Boolean {
        val age = (SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos) / 1_000_000
        return location.latitude.isFinite() && location.longitude.isFinite() &&
            location.latitude in -90.0..90.0 && location.longitude in -180.0..180.0 &&
            location.hasAccuracy() && location.accuracy.isFinite() && location.accuracy >= 0 &&
            location.elapsedRealtimeNanos > 0 && age in 0..MAX_FIX_AGE_MS
    }
}
