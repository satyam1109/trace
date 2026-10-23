// Generated from src/data/smsBanks.json. Run node scripts/generate-bank-registry.cjs.
package com.tracemymoney.ledger

import java.util.Locale

object BankRegistry {
    data class Profile(val name: String, val cardOnly: Boolean)
    private val senders = mapOf(
        "HDFCBK" to Profile("HDFC Bank", false),
        "HDFCBN" to Profile("HDFC Bank", false),
        "ICICIB" to Profile("ICICI Bank", false),
        "ICICIT" to Profile("ICICI Bank", false),
        "SBIINB" to Profile("SBI", false),
        "SBIPSG" to Profile("SBI", false),
        "SBIBNK" to Profile("SBI", false),
        "SBIUPI" to Profile("SBI", false),
        "SBIYNO" to Profile("SBI", false),
        "ATMSBI" to Profile("SBI", false),
        "SBICRD" to Profile("SBI Card", true),
        "AXISBK" to Profile("Axis Bank", false),
        "KOTAKB" to Profile("Kotak Mahindra Bank", false),
        "IDFCBK" to Profile("IDFC FIRST Bank", false),
        "IDFCFB" to Profile("IDFC FIRST Bank", false),
        "FEDBNK" to Profile("Federal Bank", false),
        "FEDBK" to Profile("Federal Bank", false),
        "PNBSMS" to Profile("Punjab National Bank", false),
        "PNBBNK" to Profile("Punjab National Bank", false),
        "CANBNK" to Profile("Canara Bank", false),
        "CNRBNK" to Profile("Canara Bank", false),
        "UNIONB" to Profile("Union Bank of India", false),
        "UBISMS" to Profile("Union Bank of India", false),
        "BARBSM" to Profile("Bank of Baroda", false),
        "BOBSMS" to Profile("Bank of Baroda", false),
        "BOBTXN" to Profile("Bank of Baroda", false),
        "BOBCRD" to Profile("Bank of Baroda", false),
        "BOIIND" to Profile("Bank of India", false),
        "BOIBNK" to Profile("Bank of India", false),
        "BOISML" to Profile("Bank of India", false),
        "INDBNK" to Profile("Indian Bank", false),
        "INDBKS" to Profile("Indian Bank", false),
        "INDUSB" to Profile("IndusInd Bank", false),
        "YESBNK" to Profile("YES Bank", false),
        "YESBK" to Profile("YES Bank", false),
        "HSBCIN" to Profile("HSBC", false),
        "HSBC" to Profile("HSBC", false),
        "SCBANK" to Profile("Standard Chartered", false),
        "AMEXIN" to Profile("American Express", true),
        "AMEX" to Profile("American Express", true)
    )

    fun identify(sender: String): Profile? = sender.uppercase(Locale.ROOT)
        .split('-').firstNotNullOfOrNull { senders[it] }
}
