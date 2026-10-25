package com.tracemymoney.ledger

import android.animation.ValueAnimator
import android.os.Build
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import java.util.function.Consumer
import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.net.Uri
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.Editable
import android.text.InputFilter
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.tracemymoney.R
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/** The debit is persisted before this optional native editor opens. */
class PaymentPromptActivity : Activity() {
    companion object {
        fun launchIntent(context: Context, transactionId: String) = Intent(context, PaymentPromptActivity::class.java)
            .putExtra("transactionId", transactionId)
            // No launcher-task affinity; distinct payments must not reuse an older card's task.
            .setData(Uri.Builder().scheme("trace-payment").authority("transaction").appendPath(transactionId).build())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or Intent.FLAG_ACTIVITY_NO_ANIMATION)
    }
    private lateinit var prompt: Dialog
    val paymentWindow get() = prompt.window!!
    private val handler = Handler(Looper.getMainLooper())
    private var disposed = false
    private var saving = false
    private var expanded = false
    private var closing = false
    private var gestureActive = false
    private var blurListener: Consumer<Boolean>? = null
    private var sizeAnimation: ValueAnimator? = null
    private lateinit var card: LinearLayout
    private lateinit var summary: LinearLayout
    private lateinit var details: LinearLayout
    private lateinit var scroll: ScrollView
    private var discardConfirmed = false
    private var dialogOpen = false
    private var saveFailed = false
    private var dirty = false
    private var deadline = 0L
    private var draftRevision = 0
    private var restoredState: Bundle? = null
    private lateinit var transactionId: String
    private lateinit var repository: LedgerRepository
    private lateinit var countdown: TextView
    private lateinit var recipient: EditText
    private lateinit var remarks: EditText
    private lateinit var categoryButton: Button
    private lateinit var save: Button
    private lateinit var edit: Button
    private lateinit var discard: Button
    private var category = "expense"
    private var expenseCategory = "uncategorised"
    private var categorySelected = false
    private var rememberedCategory = false
    private lateinit var compactCategory: TextView
    private var choiceDialog: AlertDialog? = null
    private val options = mutableListOf(
        "uncategorised" to "Expense (optional)", "food" to "Food", "clothes" to "Clothes",
        "groceries" to "Groceries", "travel" to "Travel", "bills" to "Bills & utilities",
        "health" to "Health", "entertainment" to "Entertainment", "other" to "Other", "lent" to "Lent money"
    )
    private val ticker = object : Runnable { override fun run() { tick() } }
    private val draftWriter = Runnable { persistDraft(false) }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        restoredState = state
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
        window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
        // A small activity in a separate task has an Android input sink outside
        // its bounds. Receive that area on a transparent host instead, so an
        // outside tap can dismiss without passing a click to another app.
        setContentView(View(this).apply { setOnClickListener { finish() } })
        prompt = object : Dialog(this, R.style.PaymentCardTheme) {
            override fun onTouchEvent(event: MotionEvent): Boolean {
                if (event.action == MotionEvent.ACTION_OUTSIDE) { this@PaymentPromptActivity.finish(); return true }
                return super.onTouchEvent(event)
            }
        }.apply {
            setCanceledOnTouchOutside(false)
            setOnCancelListener { this@PaymentPromptActivity.finish() }
        }
        paymentWindow.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        paymentWindow.setGravity(Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL)
        paymentWindow.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
        paymentWindow.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH)
        paymentWindow.setDimAmount(0f)
        paymentWindow.attributes = paymentWindow.attributes.apply { y = dp(12) }

        paymentWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
        transactionId = intent.getStringExtra("transactionId") ?: run { finish(); return }
        repository = LedgerRepository.get(this)
        repository.executor.execute {
            try {
                // An older notification must also honour a subsequently enabled app lock.
                if (repository.preferences().optBoolean("appLock", false)) {
                    runOnUiThread {
                        // Only an explicit notification tap may open the locked app.
                        // An automatic alert must never bring its homepage forward.
                        if (intent.getBooleanExtra("userInitiated", false)) {
                            startActivity(Intent(this, com.tracemymoney.MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        }
                        finish()
                    }
                    return@execute
                }
                val record = repository.find(transactionId)
                val custom = repository.planning(record?.optBoolean("demo") ?: false).optJSONArray("categories")
                if (custom != null) for (i in 0 until custom.length()) {
                    val c = custom.getJSONObject(i); options.add(c.getString("id") to c.getString("name"))
                }
                runOnUiThread {
                    if (!disposed && !isDestroyed && !isFinishing && record != null) render(record) else finish()
                }
            } catch (_: Exception) { runOnUiThread { finish() } }
        }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun tint(resource: Int) = getColor(resource)
    private fun text(value: String, size: Float, color: Int = tint(R.color.trace_on_navy), bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size; setTextColor(color)
        if (bold) setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(6), 0, dp(6))
    }
    private fun field(value: String, label: String, limit: Int) = EditText(this).apply {
        setText(value); hint = label; contentDescription = label
        setTextColor(tint(R.color.trace_on_navy)); setHintTextColor(tint(R.color.trace_on_navy_muted))
        backgroundTintList = ColorStateList.valueOf(tint(R.color.trace_gold))
        filters = arrayOf(InputFilter.LengthFilter(limit)); textSize = 16f
        minimumHeight = dp(48)
    }
    private fun watch(field: EditText) {
        field.setOnFocusChangeListener { _, focused -> if (focused) interact() }
        field.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) { changed() }
        })
    }
    private fun button(label: String, primary: Boolean = false) = Button(this).apply {
        text = label; minimumHeight = dp(48)
        backgroundTintList = ColorStateList.valueOf(tint(if (primary) R.color.trace_gold else R.color.trace_navy_raised))
        setTextColor(tint(if (primary) R.color.trace_navy else R.color.trace_on_navy))
    }

    private fun render(record: JSONObject) {
        val state = restoredState
        category = state?.getString("category") ?: record.getString("category")
        expenseCategory = state?.getString("expenseCategory") ?: record.getString("expenseCategory")
        categorySelected = state?.getBoolean("categorySelected") ?: false
        rememberedCategory = record.optString("categorySource") == "vendor"
        expanded = state?.getBoolean("expanded") ?: false
        card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(10), dp(22), dp(18))
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(0x0CFFFFFF, 0x00FFFFFF)).apply {
                cornerRadius = dp(28).toFloat(); setStroke(dp(1), 0x45FFFFFF)
            }
            clipToOutline = true; isFocusableInTouchMode = true
        }
        summary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; minimumHeight = dp(48); isClickable = true
            contentDescription = if (expanded) "Collapse payment details" else "Show payment details"
            setOnClickListener { setExpanded(!expanded) }
        }
        val handleArea = LinearLayout(this).apply {
            gravity = Gravity.CENTER; minimumHeight = dp(22)
            addView(View(this@PaymentPromptActivity).apply {
                background = GradientDrawable().apply { setColor(0x88BBC5D5.toInt()); cornerRadius = dp(3).toFloat() }
            }, LinearLayout.LayoutParams(dp(36), dp(4)))
        }
        summary.addView(handleArea)
        attachDrag(summary)
        card.addView(summary)
        details = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; visibility = if (expanded) View.VISIBLE else View.GONE
        }
        summary.addView(text("trace  /  PAYMENT DETECTED", 13f, tint(R.color.trace_on_navy_muted), true))
        summary.addView(text(NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
            .format(record.getLong("amountPaise") / 100.0), 36f, tint(R.color.trace_gold), bold = true))
        val suffix = record.getString("account").takeIf { it.isNotEmpty() }?.let { " · ••$it" }.orEmpty()
        summary.addView(text("${record.getString("method")} · ${record.getString("bank")}$suffix", 14f))
        summary.addView(text("To ${record.optString("recipient").ifEmpty { "Unknown recipient" }}", 17f, bold = true).apply {
            maxLines = 2; ellipsize = android.text.TextUtils.TruncateAt.END
        })
        compactCategory = text("", 13f, tint(R.color.trace_gold)).apply { contentDescription = "Payment category" }
        summary.addView(compactCategory)
        countdown = text("", 13f, tint(R.color.trace_on_navy_muted))
        countdown.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_NONE
        details.addView(countdown)
        recipient = field(state?.getString("recipient") ?: record.optString("recipient"), "Recipient (optional)", 100).apply {
            setSingleLine(true)
            visibility = if (state?.getBoolean("recipientVisible") == true) View.VISIBLE else View.GONE
        }
        details.addView(recipient)
        details.addView(text("Remarks (optional)", 13f, tint(R.color.trace_on_navy_muted)))
        remarks = field(state?.getString("remarks") ?: record.optString("remarks"), "Payment remarks", 500).apply {
            hint = "Add a note"; minLines = 1; maxLines = 3
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }
        details.addView(remarks)
        details.addView(text("Category (optional)", 13f, tint(R.color.trace_on_navy_muted)))
        categoryButton = button("").apply { contentDescription = "Choose category"; gravity = Gravity.START or Gravity.CENTER_VERTICAL }
        updateCategoryLabel()
        categoryButton.setOnClickListener { showCategory() }
        details.addView(categoryButton, LinearLayout.LayoutParams(-1, dp(48)))
        watch(recipient); watch(remarks)
        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(10), 0, 0) }
        edit = button("Edit").apply {
            setOnClickListener { interact(); recipient.visibility = View.VISIBLE; resizeSheet(true); recipient.requestFocus() }
        }
        save = button("Save", true).apply { setOnClickListener { persistDraft(true, force = true) } }
        discard = button("Discard").apply {
            setTextColor(tint(R.color.trace_danger_on_navy)); setOnClickListener { showDiscard() }
        }
        details.addView(save, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(10) })
        listOf(edit, discard).forEach { buttons.addView(it, LinearLayout.LayoutParams(0, dp(48), 1f)) }
        details.addView(buttons)
        details.addView(text("Optional details · saved privately on your phone.", 11f, tint(R.color.trace_on_navy_muted)))
        card.addView(details)
        scroll = ScrollView(this).apply { isFillViewport = false; addView(card); clipToOutline = true }
        prompt.setContentView(scroll)
        prompt.show()
        if (Build.VERSION.SDK_INT >= 31) {
            blurListener = Consumer { enabled -> applyGlass(enabled) }
            windowManager.addCrossWindowBlurEnabledListener(mainExecutor, blurListener!!)
            applyGlass(windowManager.isCrossWindowBlurEnabled)
        } else applyGlass(false)
        card.requestFocus()
        applyWindowMode()
        paymentWindow.setLayout(sheetWidth(), WindowManager.LayoutParams.WRAP_CONTENT)
        scroll.post {
            if (!disposed && !closing) {
                resizeSheet(false)
                if (motionEnabled()) paymentWindow.decorView.apply {
                    translationY = height.toFloat() + dp(24); alpha = 0f; scaleX = 0.96f; scaleY = 0.96f
                    animate().translationY(0f).scaleX(1f).scaleY(1f).setDuration(440).setInterpolator(OvershootInterpolator(0.65f)).start()
                    card.alpha = 0f
                    alpha = 1f
                    card.animate().alpha(1f).setDuration(180).setInterpolator(DecelerateInterpolator()).start()
                }
            }
        }
        dirty = state?.getBoolean("dirty") ?: false
        if (dirty) draftRevision = 1
        // A notification opened later also gets a fresh visible paymentWindow. Clock
        // changes cannot shorten the interaction window; rotation preserves it.
        deadline = state?.getLong("deadline")?.takeIf { it > 0 } ?: (SystemClock.elapsedRealtime() + 5_000)
        tick()
        if (dirty) handler.post(draftWriter)
    }

    private fun sheetWidth() = minOf((resources.displayMetrics.widthPixels * 0.92).toInt(), dp(440))
    private fun motionEnabled() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
    private fun applyGlass(enabled: Boolean) {
        if (disposed) return
        if (Build.VERSION.SDK_INT >= 31) paymentWindow.setBackgroundBlurRadius(if (enabled) dp(28) else 0)
        paymentWindow.setBackgroundDrawable(GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            if (enabled) intArrayOf(0xF2243653.toInt(), 0xEB17233D.toInt())
            else intArrayOf(tint(R.color.trace_navy_raised), tint(R.color.trace_navy))).apply { cornerRadius = dp(28).toFloat() })
    }
    private fun applyWindowMode() {
        if (expanded) {
            paymentWindow.clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)
            paymentWindow.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            paymentWindow.setDimAmount(0.16f)
        } else {
            paymentWindow.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            paymentWindow.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH)
            paymentWindow.setDimAmount(0f)
        }
    }
    private fun setExpanded(value: Boolean) {
        if (disposed || closing || saving) return
        interact()
        if (expanded == value) return
        expanded = value
        summary.contentDescription = if (expanded) "Collapse payment details" else "Show payment details"
        if (!expanded) {
            (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                .hideSoftInputFromWindow(card.windowToken, 0)
            card.requestFocus()
        }
        resizeSheet(true)
        applyWindowMode()
    }
    private fun resizeSheet(animate: Boolean) {
        sizeAnimation?.cancel()
        val from = paymentWindow.decorView.height.takeIf { it > 0 } ?: card.height
        details.visibility = if (expanded) View.VISIBLE else View.GONE
        card.measure(View.MeasureSpec.makeMeasureSpec(sheetWidth(), View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
        val target = minOf(card.measuredHeight, (resources.displayMetrics.heightPixels * 0.82).toInt())
        scroll.scrollTo(0, 0)
        if (!animate || !motionEnabled() || from <= 0) {
            details.alpha = 1f; paymentWindow.setLayout(sheetWidth(), target); return
        }
        details.alpha = if (expanded) 0f else 1f
        sizeAnimation = ValueAnimator.ofInt(from, target).apply {
            duration = 260; interpolator = DecelerateInterpolator()
            addUpdateListener { paymentWindow.setLayout(sheetWidth(), it.animatedValue as Int) }
            start()
        }
        if (expanded) details.animate().alpha(1f).setStartDelay(70).setDuration(190).start()
    }
    private fun attachDrag(view: View) {
        var startY = 0f; var startX = 0f
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        view.setOnTouchListener { target, event ->
            if (closing || saving) return@setOnTouchListener true
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startY = event.rawY; startX = event.rawX; gestureActive = true
                    handler.removeCallbacks(ticker); target.parent.requestDisallowInterceptTouchEvent(true)
                }
                MotionEvent.ACTION_MOVE -> {
                    val delta = event.rawY - startY
                    if (motionEnabled()) paymentWindow.decorView.translationY = delta.coerceIn(-dp(24).toFloat(), dp(56).toFloat()) * 0.3f
                }
                MotionEvent.ACTION_UP -> {
                    gestureActive = false; target.parent.requestDisallowInterceptTouchEvent(false)
                    paymentWindow.decorView.animate().translationY(0f).setDuration(if (motionEnabled()) 150 else 0).start()
                    val delta = event.rawY - startY
                    when {
                        delta < -dp(32) -> setExpanded(true)
                        delta > dp(48) -> if (expanded) setExpanded(false) else finish()
                        kotlin.math.abs(delta) < slop && kotlin.math.abs(event.rawX - startX) < slop -> target.performClick()
                        else -> interact()
                    }
                }
                MotionEvent.ACTION_CANCEL -> {
                    gestureActive = false; target.parent.requestDisallowInterceptTouchEvent(false)
                    paymentWindow.decorView.translationY = 0f; interact()
                }
            }
            true
        }
    }
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_OUTSIDE) { finish(); return true }
        return super.dispatchTouchEvent(event)
    }
    override fun finish() {
        if (disposed || !::card.isInitialized || !motionEnabled()) { super.finish(); return }
        if (closing) return
        persistDraft(false)
        closing = true; gestureActive = false; handler.removeCallbacks(ticker); handler.removeCallbacks(draftWriter)
        sizeAnimation?.cancel()
        paymentWindow.decorView.animate().translationY(paymentWindow.decorView.height.toFloat() + dp(24)).alpha(0f)
            .setDuration(180).setStartDelay(0).withEndAction { super.finish() }.start()
    }

    private fun updateCategoryLabel() {
        val code = if (category == "lent") "lent" else expenseCategory
        val label = options.firstOrNull { it.first == code }?.second ?: "Expense"
        categoryButton.text = "$label  ▾"
        compactCategory.visibility = if (category == "expense" && expenseCategory != "uncategorised") View.VISIBLE else View.GONE
        compactCategory.text = label + if (rememberedCategory && !categorySelected) " · Remembered" else ""
    }
    private fun interact() {
        if (disposed || saving || closing) return
        deadline = SystemClock.elapsedRealtime() + 10_000
        handler.removeCallbacks(ticker)
        tick()
    }
    private fun changed() {
        dirty = true; draftRevision++
        interact()
        handler.removeCallbacks(draftWriter)
        handler.postDelayed(draftWriter, 250)
    }
    private fun showCategory() {
        interact(); dialogOpen = true
        handler.removeCallbacks(ticker)
        countdown.text = "Choose a category · your payment is already saved"
        val selected = if (category == "lent") "lent" else expenseCategory
        choiceDialog = AlertDialog.Builder(this).setTitle("Category (optional)")
            .setSingleChoiceItems(options.map { it.second }.toTypedArray(), options.indexOfFirst { it.first == selected }) { dialog, which ->
                val code = options[which].first
                categorySelected = true
                category = if (code == "lent") "lent" else "expense"
                expenseCategory = if (code == "lent") "uncategorised" else code
                updateCategoryLabel(); changed(); dialog.dismiss()
            }.setNegativeButton("Cancel", null).create().also { dialog ->
                dialog.setOnDismissListener { dialogOpen = false; if (!disposed && !saving) interact() }
                dialog.show()
            }
    }
    private fun showDiscard() {
        dialogOpen = true; handler.removeCallbacks(ticker)
        countdown.text = "Your payment stays saved unless you confirm discard"
        choiceDialog = AlertDialog.Builder(this).setTitle("Discard this entry?")
            .setMessage("Remove this payment from Trace? This cannot be undone. Your bank payment and SMS stay unchanged.")
            .setNegativeButton("Keep entry", null)
            .setPositiveButton("Discard entry") { _, _ ->
                saving = true; discardConfirmed = true; controls(false)
                handler.removeCallbacks(draftWriter)
                repository.executor.execute {
                    try {
                        repository.discard(transactionId); PaymentNotifications.cancel(this, transactionId)
                        runOnUiThread { finish() }
                    } catch (_: Exception) { runOnUiThread { discardConfirmed = false; failed("Could not discard. Please try again.") } }
                }
            }.create().also { dialog ->
                dialog.setOnDismissListener { dialogOpen = false; if (!disposed && !saving) interact() }
                dialog.show(); dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(tint(R.color.trace_danger))
            }
    }
    private fun controls(enabled: Boolean) {
        listOf(recipient, remarks, categoryButton, edit, save, discard).forEach { it.isEnabled = enabled }
    }
    private fun tick() {
        if (disposed || saving || closing || gestureActive || dialogOpen || saveFailed) return
        val remaining = deadline - SystemClock.elapsedRealtime()
        if (remaining <= 0) { persistDraft(true); return }
        countdown.text = "Already saved · closes in ${kotlin.math.ceil(remaining / 1000.0).toInt()}s"
        handler.removeCallbacks(ticker); handler.postDelayed(ticker, 100)
    }
    private fun failed(message: String) {
        saving = false; setExpanded(true); saveFailed = true; controls(true)
        handler.removeCallbacks(ticker)
        countdown.text = message
    }
    private fun persistDraft(close: Boolean, force: Boolean = false) {
        if (disposed || saving || closing || discardConfirmed || !::recipient.isInitialized) return
        handler.removeCallbacks(draftWriter)
        if (!dirty && !force) {
            if (close) { saving = true; PaymentNotifications.cancel(this, transactionId); finish() }
            return
        }
        val revision = draftRevision
        val name = recipient.text.toString(); val note = remarks.text.toString()
        val kind = category; val expense = expenseCategory; val selected = categorySelected
        if (close) { saving = true; controls(false); handler.removeCallbacks(ticker) }
        repository.executor.execute {
            try {
                repository.update(transactionId, name, kind, expense, note, selected)
                if (close) PaymentNotifications.cancel(this, transactionId)
                runOnUiThread {
                    if (revision == draftRevision) { dirty = false; categorySelected = false }
                    if (!disposed) {
                        saveFailed = false
                        if (close) finish() else tick()
                    }
                }
            } catch (_: Exception) { runOnUiThread { if (!disposed) failed("Could not save changes. Tap Save to retry.") } }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::recipient.isInitialized) {
            outState.putString("recipient", recipient.text.toString()); outState.putString("remarks", remarks.text.toString())
            outState.putString("category", category); outState.putString("expenseCategory", expenseCategory)
            outState.putBoolean("recipientVisible", recipient.visibility == View.VISIBLE)
            outState.putBoolean("categorySelected", categorySelected); outState.putBoolean("expanded", expanded); outState.putBoolean("dirty", dirty); outState.putLong("deadline", deadline)
        }
        super.onSaveInstanceState(outState)
    }
    override fun onPause() {
        // Back/outside taps and app switches retain optional edits too. The
        // repository only updates existing IDs, so late writes cannot resurrect a discard.
        if (!isChangingConfigurations && !discardConfirmed) persistDraft(false)
        super.onPause()
        // An outside tap may switch to another task before ACTION_OUTSIDE is
        // delivered. Do not leave a stale card behind that task to reopen later.
        if (!isChangingConfigurations && !isFinishing && !closing) finish()
    }
    override fun onDestroy() {
        if (!discardConfirmed) persistDraft(false)
        disposed = true; handler.removeCallbacksAndMessages(null)
        sizeAnimation?.cancel(); if (::card.isInitialized) paymentWindow.decorView.animate().cancel()
        if (::prompt.isInitialized) prompt.dismiss()
        if (Build.VERSION.SDK_INT >= 31) blurListener?.let { windowManager.removeCrossWindowBlurEnabledListener(it) }
        choiceDialog?.setOnDismissListener(null); choiceDialog?.dismiss()
        super.onDestroy()
    }
}
