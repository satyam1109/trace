package com.tracemymoney.ledger
import org.junit.Assert.*
import org.junit.Test
import java.util.Locale

class VendorIdentityTest {
    @Test fun exactNamesIgnoreCaseAndWhitespaceOnly() {
        assertEquals("sharma stores 12", VendorIdentity.normalise("  SHARMA\u00a0 STORES\t 12 "))
        assertEquals("nj*sharma-12@upi", VendorIdentity.normalise("NJ*Sharma-12@UPI"))
        assertNotEquals(VendorIdentity.normalise("Sharma 12"), VendorIdentity.normalise("Sharma 21"))
        assertNotEquals(VendorIdentity.normalise("Sharma Medical"), VendorIdentity.normalise("Sharma Stores"))
        assertEquals("", VendorIdentity.normalise(" \n\t "))
    }
    @Test fun namesDoNotDependOnDeviceLocale() {
        val original = Locale.getDefault()
        try { Locale.setDefault(Locale.forLanguageTag("tr-TR")); assertEquals("icici shop", VendorIdentity.normalise("ICICI SHOP")) }
        finally { Locale.setDefault(original) }
    }
}
