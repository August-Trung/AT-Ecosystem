DELETE FROM recently_played
WHERE rowid NOT IN (
  SELECT rowid
  FROM (
    SELECT
      rowid,
      ROW_NUMBER() OVER (
        PARTITION BY anonymous_user_id, item_id, item_type
        ORDER BY played_at DESC, rowid DESC
      ) AS row_number
    FROM recently_played
  )
  WHERE row_number = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_played_user_item_type
ON recently_played(anonymous_user_id, item_id, item_type);
