package com.tracemymoney.ledger;

import androidx.room.Database;
import androidx.room.RoomDatabase;

@Database(entities = {StoredTransaction.class, StoredPlan.class}, version = 2, exportSchema = false)
public abstract class LedgerDatabase extends RoomDatabase {
    public abstract TransactionDao transactions();
    public abstract PlanningDao planning();
}
