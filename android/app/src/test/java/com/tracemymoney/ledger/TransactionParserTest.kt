package com.tracemymoney.ledger

import org.junit.Assert.*
import org.junit.Test

class TransactionParserTest {
    @Test fun `extract debit rather than available balance`() {
        val result = TransactionParser.parse("VM-HDFCBK", "A/c XX4821 debited by INR 240.50 to Blue Tokai via UPI. Ref 612345678901. Avl bal INR 90,000.00")!!
        assertEquals(24050L, result.amountPaise)
        assertEquals("4821", result.account)
        assertEquals("Blue Tokai", result.recipient)
        assertEquals("UPI", result.method)
        assertEquals("612345678901", result.reference)
    }
    @Test fun `extract card spend with Indian number grouping`() {
        val result = TransactionParser.parse("AD-ICICIB", "INR 1,28,999.90 spent on ICICI Bank card ending 9164 at Amazon on 19-Oct-2026. Ref 612345678902.")!!
        assertEquals(12899990L, result.amountPaise)
        assertEquals("CARD", result.method)
        assertEquals("Amazon", result.recipient)
        assertEquals("9164", result.account)
    }
    @Test fun `support SBI and sender suffix`() {
        val result = TransactionParser.parse("JD-SBIUPI-S", "Your A/c XX7032 debited by Rs. 799.00 to Airtel via UPI. Ref 612345678903.")!!
        assertEquals(79900L, result.amountPaise)
        assertEquals("SBI", result.bank)
    }
    @Test fun `amount before debited and unicode rupees`() {
        assertEquals(10001L, TransactionParser.parse("HDFCBK", "₹100.01 has been debited from your account XX4821.")!!.amountPaise)
    }
    @Test fun `do not extract OTP as payment`() {
        assertNull(TransactionParser.parse("VM-HDFCBK", "918273 is your OTP for INR 2,500.00. Your account will be debited."))
    }
    @Test fun `ignore unsuccessful payments and refunds`() {
        listOf("failed", "declined", "reversed", "refunded", "credited", "scheduled", "requested").forEach { word ->
            assertNull(word, TransactionParser.parse("VM-HDFCBK", "Your account debited by INR 500.00. Transaction $word."))
        }
    }
    @Test fun `ignore personal and unrecognised sender`() {
        assertNull(TransactionParser.parse("+919876543210", "A/c XX4821 debited by INR 250.00"))
        assertNull(TransactionParser.parse("VM-UNKNOWN", "A/c XX4821 debited by INR 250.00"))
    }
    @Test fun `do not use balance when debit amount missing`() {
        assertNull(TransactionParser.parse("VM-HDFCBK", "Your account has been debited. Avl balance INR 9,000.00."))
    }
    @Test fun `reject zero negative malformed and excessive amounts`() {
        listOf("0.00", "-100.00", "10.999", "99999999999999999999999999", "100000001.00").forEach { amount ->
            assertNull(amount, TransactionParser.parse("VM-HDFCBK", "A/c XX4821 debited by INR $amount"))
        }
    }
    @Test fun `never guess missing recipient or bank account`() {
        val result = TransactionParser.parse("VM-HDFCBK", "INR 123.45 debited.")!!
        assertEquals("", result.recipient)
        assertEquals("", result.account)
        assertEquals("BANK", result.method)
    }
    @Test fun `ignore oversized input`() {
        assertNull(TransactionParser.parse("VM-HDFCBK", "A/c XX4821 debited by INR 250.00" + "a".repeat(5000)))
    }
    @Test fun `recognise reported ICICI sender with transaction suffix`() {
        val result = TransactionParser.inspect("AX-ICICIT-S", "A/c XX4821 debited by INR 10.00 via UPI. Ref 612345678911.")
        assertEquals(1000L, result.payment!!.amountPaise)
        assertEquals("ICICI Bank", result.payment!!.bank)
        assertEquals("matched", result.reasonCode)
    }
    @Test fun `accept reported ICICI debit wording and short masked account`() {
        val result = TransactionParser.parse("AX-ICICIT-S", "ICICI Bank Acct XX123 debited for RS 1.00 on 19-Oct-26;")!!
        assertEquals(100L, result.amountPaise)
        assertEquals("ICICI Bank", result.bank)
        assertEquals("123", result.account)
    }
    @Test fun `capture full ICICI debit despite recipient being credited`() {
        val body = "ICICI Bank Acct XX123 debited for RS 1.00 on 19-Oct-26; Example Person credited. UPI: 123456789. Call 1800000000 for dispute. SMS BLOCK 123 to 56789"
        val result = TransactionParser.parse("AX-ICICIT-S", body)!!
        assertEquals(100L, result.amountPaise)
        assertEquals("123", result.account)
        assertEquals("UPI", result.method)
        assertEquals("Example Person", result.recipient)
        assertEquals("123456789", result.reference)
    }
    @Test fun `do not treat own account credit as an expense when sender debit is mentioned`() {
        assertNull(TransactionParser.parse("AX-ICICIT-S", "ICICI Bank Acct XX123 credited for RS 1.00; Sender debited for RS 1.00. UPI: 123456789."))
        assertNull(TransactionParser.parse("AX-ICICIT-S", "ICICI Bank Acct XX123 debited for RS 1.00; Your account credited. UPI: 123456789."))
        assertNull(TransactionParser.parse("AX-ICICIT-S", "ICICI Bank Acct XX123 debited for RS 1.00; Transaction credited. UPI: 123456789."))
    }
    @Test fun `ICICI beneficiary clause does not override OTP failure or refund exclusion`() {
        val body = "ICICI Bank Acct XX123 debited for RS 1.00; Example Person credited. UPI: 123456789."
        listOf("OTP 123456", "Transaction failed", "Amount refunded").forEach {
            assertNull(TransactionParser.parse("AX-ICICIT-S", "$body $it"))
        }
    }
    @Test fun `diagnostics distinguish sender format and excluded message`() {
        assertEquals("unsupported_sender", TransactionParser.inspect("VM-UNKNOWN", "INR 10.00 debited.").reasonCode)
        assertEquals("unsupported_format", TransactionParser.inspect("AX-ICICIT-S", "Your account was debited. Balance INR 99.00.").reasonCode)
        assertEquals("ignored_message", TransactionParser.inspect("AX-ICICIT-S", "OTP 123456 for INR 10.00.").reasonCode)
    }
    @Test fun explicitCompletedCardTransactionAndCardUsedForAmount() {
        val made = TransactionParser.parse("VM-KOTAKB-S", "Transaction of Rs.500.00 has been made on Kotak credit card xx4321 on 20-Oct at Example Shop.")!!
        assertEquals(50000L, made.amountPaise)
        assertEquals("CARD", made.method)
        assertEquals("4321", made.account)
        assertEquals("Example Shop", made.recipient)
        val used = TransactionParser.parse("VM-SBICRD-S", "Your SBI credit card ending 4321 was used for INR 125.00 at Example Shop on 20-Oct-26.")!!
        assertEquals(12500L, used.amountPaise)
        assertEquals("CARD", used.method)
    }
    @Test fun cardUsePatternsIgnoreLimitsAndUnlabelledAccountTransactions() {
        assertNull(TransactionParser.parse("VM-SBICRD-S", "SBI Card ending 4321 credit limit used INR 5000.00."))
        assertNull(TransactionParser.parse("VM-KOTAKB-S", "Transaction of Rs.500.00 has been made on account xx1234."))
    }
}
