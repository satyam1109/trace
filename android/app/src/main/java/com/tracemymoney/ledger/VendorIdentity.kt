package com.tracemymoney.ledger

import java.util.Locale

/** Exact names only: preserve words, punctuation and numbers. */
object VendorIdentity {
    private val spaces = Regex("[\\s\\p{Z}]+")
    fun normalise(name: String): String = spaces.replace(name, " ").trim().lowercase(Locale.ROOT)
}
