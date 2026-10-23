package com.tracemymoney.ledger;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "transactions")
public class StoredTransaction {
    @PrimaryKey @NonNull public String id = "";
    @NonNull public String payload = "";
    public long receivedAt;
    public boolean demo;
}
