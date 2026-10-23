package com.tracemymoney.ledger

import java.math.BigDecimal
import java.math.RoundingMode

/** INR-only, on-device parsing. Unknown formats are not guessed from balances. */
object TransactionParser {
    data class Payment(
        val amountPaise: Long, val bank: String, val account: String,
        val method: String, val recipient: String, val reference: String
    )
    data class Result(val payment: Payment?, val reasonCode: String)

    private const val money = "(?:INR\\s*:?|Rs[.:]?|₹)\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)(?![0-9]|\\.[0-9])"
    private const val action = "(?:debited|spent|paid|purchase(?:d)?|withdrawn)"
    private fun rx(pattern: String) = Regex(pattern, RegexOption.IGNORE_CASE)
    private val credit = rx("\\b(?:credited|credit received)\\b")
    private val forbidden = rx(
        "\\b(?:OTP|one[ -]time|verification code|will be|to be debited|scheduled|declined|failed|unsuccessful|reversed|reversal|refunded|refund|requested|request received)\\b"
    )
    private val nonSpend = rx(
        "\\b(?:payment|collect|transaction)\\s+request\\b|\\b(?:total|minimum)\\s+(?:amount\\s+)?due\\b|\\bpayment\\s+(?:is\\s+)?due\\b|\\b(?:bill|statement)\\s+(?:(?:has been|is)\\s+)?(?:generated|ready|due)\\b"
    )
    // Remove only a literal safety warning, not an OTP or authorisation code.
    private val safetyWarning = rx(
        "\\b(?:never|do not|don't)\\s+share\\s+(?:your\\s+)?OTP\\b(?:\\s*[/,]\\s*(?:PIN|CVV|password))*(?!\\s*[/,]\\s*(?:PIN|CVV|password))(?!\\s*[:=-]?\\s*\\d)"
    )
    private const val token = "([0-9xX*•][0-9xX*•._-]*(?:\\s+\\d{3,5})?)(?![A-Za-z0-9xX*•])"
    private val accountPattern = rx("\\b(?:a/c|a\\.c\\.?|ac|acct|account)(?:\\s*(?:no\\.?|number))?\\s*[:.-]?\\s*$token")
    private val cardPattern = rx("\\b(?:credit\\s*card|debit\\s*card|card|BOBCARD)(?:\\s*(?:no\\.?|ending(?:\\s+with)?|number))?\\s*[:.-]?\\s*$token")

    fun parse(sender: String, body: String): Payment? = inspect(sender, body).payment

    fun inspect(sender: String, rawBody: String): Result {
        val profile = BankRegistry.identify(sender) ?: return Result(null, "unsupported_sender")
        if (rawBody.length > 4096) return Result(null, "ignored_message")
        val body = rawBody.replace('\u00a0', ' ').replace("\r\n", "\n")
        val guarded = safetyWarning.replace(body, "")
        if (forbidden.containsMatchIn(guarded) || nonSpend.containsMatchIn(guarded)) return Result(null, "ignored_message")

        val card = cardPattern.findAll(body).firstOrNull {
            val prefix = body.substring(maxOf(0, it.range.first - 24), it.range.first)
            !rx("\\b(?:block|unblock|activate|manage)\\s*$").containsMatchIn(prefix)
        }
        val cardContext = card != null || rx("\\bon\\s+HDFC\\s+Bank\\s+card\\b").containsMatchIn(body)
        val sent = when (profile.name) {
            "HDFC Bank" -> rx("^\\s*(?:Amt\\s+)?Sent\\s*$money\\s*From\\s+HDFC\\s+Bank\\s+A/C\\b").find(body)
            "Kotak Mahindra Bank" -> rx("^\\s*Sent\\s*$money\\s*from\\s+Kotak\\s+Bank\\s+AC\\b").find(body)
            else -> null
        }
        val axisLayout = if (profile.name == "Axis Bank")
            rx("^\\s*Spent\\s*\\n\\s*(?:Axis\\s+Bank\\s+)?Card\\s+no\\.?\\s+[0-9xX* .-]+\\n\\s*$money").find(body)
            else null
        val after = rx("\\b$action\\b\\s*[:;-]?\\s*(?:(?:by|for|of|with|amount|is)\\s*[:=]?\\s*){0,2}$money").find(body)
        val before = rx("$money\\s*(?:(?:has been|was|is)\\s+)?$action\\b").find(body)
        val cardUse = if (cardContext || profile.cardOnly) {
            rx("\\bused\\s+for\\s+(?:(?:a\\s+)?(?:transaction|purchase|txn)\\s+(?:of\\s+)?)?$money").find(body)
                ?: rx("\\b(?:transaction|txn|purchase)\\s+of\\s+$money\\s+(?:(?:has been|was)\\s+)?(?:made|done)\\s+(?:on|using)\\b").find(body)
                ?: if (profile.name == "HSBC") rx("\\bused\\s+at\\s+[^\\n]{1,100}?\\s+for\\s+$money").find(body) else null
        } else null
        val amount = sent ?: axisLayout ?: after ?: before ?: cardUse
            ?: return Result(null, if (credit.containsMatchIn(body)) "ignored_message" else "unsupported_format")

        val beneficiary = if (profile.name == "ICICI Bank")
            rx(";\\s*([^;\\n]{1,100}?)\\s+(credited)\\b").find(body)?.takeIf {
                it.range.first > amount.range.last &&
                    !rx("^(?:your|our|transaction|txn|amount|payment|refund|reversal|a/c|acct|account)\\b")
                        .containsMatchIn(it.groupValues[1].trim())
            } else null
        val allowedCredits = mutableSetOf<Int>()
        beneficiary?.groups?.get(2)?.range?.first?.let { allowedCredits.add(it) }
        // These formats explicitly report the beneficiary after the user's debit.
        if (profile.name in setOf("SBI", "Bank of India", "Standard Chartered")) {
            listOf(
                rx("\\band\\s+(credited)\\s+to\\b"),
                rx("\\band\\s+(?:a/c|account)\\b[^.;\\n]{1,120}?\\s+(?:is\\s+)?(credited)\\b")
            ).forEach { pattern ->
                pattern.findAll(body).forEach { match ->
                    match.groups[1]?.range?.first?.takeIf { it > amount.range.last }?.let { allowedCredits.add(it) }
                }
            }
        }
        if (credit.findAll(body).any { it.range.first !in allowedCredits }) return Result(null, "ignored_message")

        val number = amount.groupValues[1]
        if (!rx("^\\d+(?:\\.\\d{1,2})?$").matches(number.replace(",", ""))) return Result(null, "unsupported_format")
        if (',' in number && !rx("^(?:\\d{1,3}(?:,\\d{3})+|\\d{1,2}(?:,\\d{2})+,\\d{3})(?:\\.\\d{1,2})?$").matches(number)) {
            return Result(null, "unsupported_format")
        }
        val paise = try {
            BigDecimal(number.replace(",", "")).multiply(BigDecimal(100))
                .setScale(0, RoundingMode.UNNECESSARY).longValueExact()
        } catch (_: Exception) { return Result(null, "unsupported_format") }
        if (paise <= 0 || paise > 10_000_000_000L) return Result(null, "unsupported_format")

        val account = suffix((card ?: accountPattern.find(body))?.groupValues?.get(1).orEmpty())
        val method = when {
            cardContext || profile.cardOnly -> "CARD"
            rx("\\bUPI\\b").containsMatchIn(body) -> "UPI"
            else -> "BANK"
        }
        val recipient = beneficiary?.groupValues?.get(1)?.trim()
            ?: merchant(profile.name, body, amount.range.first)
        val reference = rx("\\b(?:UPI\\s*)?(?:ref(?:erence)?(?:\\s*(?:no\\.?|number|id))?|UTR|RRN|txn\\s*(?:id|no\\.?))\\s*[:#.-]?\\s*([A-Za-z0-9]{6,35})(?![A-Za-z0-9])")
            .find(body)?.groupValues?.get(1)
            ?: rx("\\bUPI\\s*:\\s*(\\d{6,35})(?!\\d)").find(body)?.groupValues?.get(1).orEmpty()
        return Result(Payment(paise, profile.name, account, method, recipient, reference), "matched")
    }

    private fun suffix(token: String): String =
        rx("\\d{3,}$").find(token.replace(" ", "").trimEnd('.', '_', '-'))?.value?.takeLast(4).orEmpty()

    private fun merchant(bank: String, body: String, amountStart: Int): String {
        if (bank == "Axis Bank" && '\n' in body) {
            val lines = body.lines().map { it.trim() }.filter { it.isNotEmpty() }
            val date = lines.indexOfFirst { rx("^\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}\\b").containsMatchIn(it) }
            if (date >= 0 && date + 1 < lines.size) {
                val next = lines[date + 1]
                if (!rx("^(?:avl|available|SMS|not you|call|INR|Rs\\b)").containsMatchIn(next)) return next.take(100)
            }
        }
        if (bank == "YES Bank") {
            rx("@UPI[_\\s]+([^\\n]+?)\\s+\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}\\b").find(body)
                ?.groupValues?.get(1)?.trim()?.let { return it.take(100) }
        }
        if (bank == "ICICI Bank") {
            rx("\\bon\\s+\\d{1,2}[-/][A-Za-z0-9]{1,9}[-/]\\d{2,4}\\s+on\\s+([^.;\\n]+)").find(body)
                ?.groupValues?.get(1)?.trim()?.let { return it.take(100) }
        }
        val fraud = minOf(
            rx("\\b(?:Not You|If not|SMS BLOCK|Call\\s+\\d)").find(body)?.range?.first ?: body.length,
            safetyWarning.find(body)?.range?.first ?: body.length
        )
        return rx("\\b(?:to|at|towards)\\s+(?:VPA\\s+)?([A-Za-z0-9][A-Za-z0-9 @&'*._/-]{1,100}?)(?=\\s+(?:on\\b|via\\b|through\\b|ref\\b|UPI\\b|avl\\b|available\\b|RRN\\b|with\\b|for\\b)|[,;\\n]|\\.(?=\\s|$|Ref(?:\\b|\\s*No)|UPI\\b|Avl\\b)|$)")
            .findAll(body).firstOrNull {
                it.range.first > amountStart && it.range.first < fraud &&
                    !rx("^(?:a/c|ac\\b|acct\\b|account\\b|card\\b|your\\b|INR\\b|Rs\\b|\\d{1,2}[-/])")
                        .containsMatchIn(it.groupValues[1].trim())
            }?.groupValues?.get(1)?.trim().orEmpty()
    }
}
