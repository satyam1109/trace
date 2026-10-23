package com.tracemymoney.ledger

import java.io.File
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** The same synthetic, reviewed fixtures exercise Android and browser parsing. */
@RunWith(Parameterized::class)
class BankSmsCorpusTest(private val case: Case) {
    data class Case(val columns: List<String>) {
        override fun toString() = columns[0]
    }

    @Test fun extractsExpectedTransactionOrIgnoresMessage() {
        val c = case.columns
        val result = TransactionParser.parse(c[1], c[8].replace("\\n", "\n"))
        if (c[2] == "IGNORE") {
            assertNull(case.toString(), result)
        } else {
            assertNotNull(case.toString(), result)
            result!!
            assertEquals(c[2].toLong(), result.amountPaise)
            val expected = c.subList(3, 8).map { if (it == "-") "" else it }
            assertEquals(expected, listOf(result.bank, result.account, result.method, result.recipient, result.reference))
        }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Case>> = File(requireNotNull(System.getProperty("trace.smsFixtures")))
            .readLines(Charsets.UTF_8).filter { it.isNotBlank() && !it.startsWith("#") }
            .map {
                val columns = it.split('\t')
                require(columns.size == 9) { "Invalid fixture column count" }
                arrayOf(Case(columns))
            }.also { require(it.isNotEmpty()) { "Bank SMS corpus must not be empty" } }
    }
}
