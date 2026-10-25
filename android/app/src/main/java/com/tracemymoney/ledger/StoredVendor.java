package com.tracemymoney.ledger;
import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;
@Entity(tableName = "vendor_rules")
public class StoredVendor {
    @PrimaryKey @NonNull public String key = "";
    public boolean demo;
    @NonNull public String payload = "";
}
