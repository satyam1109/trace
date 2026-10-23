package com.tracemymoney.ledger;
import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
@Dao public interface PlanningDao {
    @Query("SELECT * FROM planning WHERE `key` = :key LIMIT 1") StoredPlan find(String key);
    @Insert(onConflict = OnConflictStrategy.REPLACE) void save(StoredPlan plan);
    @Query("DELETE FROM planning") void clear();
}
