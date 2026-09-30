-- 公告的业务唯一性：标题、类型和发布日期相同的记录只保留一条。
-- 保留最早创建的记录，避免重复初始化数据继续显示。
WITH ranked_notices AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(title)), lower(trim(type)), published_at
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM notices
)
DELETE FROM notices AS n
USING ranked_notices AS r
WHERE n.id = r.id
  AND r.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notices_title_type_date_unique_idx
  ON notices (lower(trim(title)), lower(trim(type)), published_at);
