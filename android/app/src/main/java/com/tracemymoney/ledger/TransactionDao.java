package com.tracemymoney.ledger;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import java.util.List;

@Dao
public interface TransactionDao {
    @Query("SELECT * FROM transactions ORDER BY receivedAt DESC")
    List<StoredTransaction> all();

    @Query("SELECT * FROM transactions WHERE id = :id LIMIT 1")
    StoredTransaction find(String id);

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insert(StoredTransaction transaction);

    @Query("UPDATE transactions SET payload = :payload WHERE id = :id")
    void update(String id, String payload);

    @Query("DELETE FROM transactions WHERE id = :id")
    void delete(String id);

    @Query("DELETE FROM transactions")
    void clear();

    @Query("DELETE FROM transactions WHERE demo = 1")
    void clearDemo();
}
