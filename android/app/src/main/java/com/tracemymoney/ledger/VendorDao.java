package com.tracemymoney.ledger;
import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import java.util.List;
@Dao public interface VendorDao {
    @Query("SELECT * FROM vendor_rules WHERE `key` = :key LIMIT 1") StoredVendor find(String key);
    @Insert(onConflict = OnConflictStrategy.REPLACE) void save(StoredVendor vendor);
    @Query("SELECT * FROM vendor_rules WHERE demo = :demo") List<StoredVendor> all(boolean demo);
    @Query("DELETE FROM vendor_rules WHERE `key` = :key AND demo = :demo") void delete(String key, boolean demo);
    @Query("DELETE FROM vendor_rules WHERE demo = :demo") void clearWorkspace(boolean demo);
    @Query("DELETE FROM vendor_rules") void clear();
}
