package com.tracemymoney.ledger

import org.junit.Assert.*
import org.junit.Test

class BankRegistryTest {
    @Test fun `match complete sender tokens rather than substrings`() {
        assertNull(BankRegistry.identify("VM-XAXISBK"))
        assertNull(BankRegistry.identify("+919000000000"))
        assertNull(BankRegistry.identify("AXISBKX"))
        assertEquals("Axis Bank", BankRegistry.identify("AX-AXISBK-S")!!.name)
    }
    @Test fun `distinguish Indian Bank from IndusInd and SBI card issuer`() {
        assertEquals("Indian Bank", BankRegistry.identify("VM-INDBNK-S")!!.name)
        assertEquals("IndusInd Bank", BankRegistry.identify("VM-INDUSB-S")!!.name)
        assertTrue(BankRegistry.identify("VM-SBICRD-S")!!.cardOnly)
        assertFalse(BankRegistry.identify("VM-SBIINB-S")!!.cardOnly)
    }
}
