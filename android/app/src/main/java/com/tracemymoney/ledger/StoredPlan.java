package com.tracemymoney.ledger;
import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;
@Entity(tableName = "planning")
public class StoredPlan {
    @PrimaryKey @NonNull public String key = "";
    @NonNull public String payload = "";
}
