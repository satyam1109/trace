package com.tracemymoney.ledger
import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

/** Uses the phone's enrolled biometrics/PIN. Trace never stores or handles a PIN. */
object DeviceUnlock {
    private var pending: Promise? = null
    fun authenticate(context: ReactApplicationContext, activity: Activity?, promise: Promise) {
        if (activity == null) { promise.reject("AUTH_UNAVAILABLE", "Open Trace to unlock it."); return }
        activity.runOnUiThread {
            if (pending != null) { promise.reject("AUTH_BUSY", "Unlock is already in progress."); return@runOnUiThread }
            val keyguard = activity.getSystemService(KeyguardManager::class.java)
            if (!keyguard.isDeviceSecure) { promise.reject("AUTH_UNAVAILABLE", "Set a screen lock in Android Settings first."); return@runOnUiThread }
            pending = promise
            if (Build.VERSION.SDK_INT >= 30) {
                val cancellation = CancellationSignal()
                val authenticators = android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG or android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL
                try {
                    android.hardware.biometrics.BiometricPrompt.Builder(activity).setTitle("Unlock Trace")
                        .setSubtitle("Use your phone's biometric or screen lock").setAllowedAuthenticators(authenticators).build()
                        .authenticate(cancellation, activity.mainExecutor, object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult) { pending?.resolve(true); pending = null }
                            override fun onAuthenticationError(code: Int, message: CharSequence) { pending?.resolve(false); pending = null }
                        })
                } catch (_: Exception) { pending?.reject("AUTH_UNAVAILABLE", "Device unlock is unavailable. Check your phone's screen lock settings."); pending = null }
            } else {
                @Suppress("DEPRECATION") val intent = keyguard.createConfirmDeviceCredentialIntent("Unlock Trace", "Use your phone's screen lock")
                val listener = object : BaseActivityEventListener() {
                    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
                        if (requestCode != 4126) return
                        pending?.resolve(resultCode == Activity.RESULT_OK); pending = null; context.removeActivityEventListener(this)
                    }
                }
                context.addActivityEventListener(listener)
                try { @Suppress("DEPRECATION") activity.startActivityForResult(intent, 4126) }
                catch (_: Exception) { context.removeActivityEventListener(listener); pending?.reject("AUTH_UNAVAILABLE", "Device unlock is unavailable."); pending = null }
            }
        }
    }
}
