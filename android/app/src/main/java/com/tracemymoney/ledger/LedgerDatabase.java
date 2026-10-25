package com.tracemymoney.ledger;

import androidx.room.Database;
import androidx.room.RoomDatabase;

@Database(entities = {StoredTransaction.class, StoredPlan.class, StoredVendor.class}, version = 3, exportSchema = false)
public abstract class LedgerDatabase extends RoomDatabase {
    public abstract TransactionDao transactions();
    public abstract PlanningDao planning();
    public abstract VendorDao vendors();
}
