-- ============================================================================
-- V5: Direct score encryption on existing score columns (no new columns)
-- ============================================================================
-- Mục tiêu: không tạo cột mới, giữ nguyên 4 cột điểm hiện có.
-- Cơ chế mã hóa/giải mã được thực thi ở ứng dụng (MyBatis interceptor).
--
-- Backfill DB hiện tại:
-- - Giá trị điểm plaintext thường nằm trong [0..5].
-- - Mã hóa tuyến tính an toàn với NUMERIC(5,2):
--     encrypted = score * 111 + 222
--   => với score tối đa 5.00 thì encrypted tối đa 777.00 (< 999.99)
-- - Chỉ mã hóa những giá trị hợp lệ chưa mã hóa (<= 5).

UPDATE kpi_assignments
SET
  mid_self_score = CASE
    WHEN mid_self_score IS NOT NULL AND mid_self_score <= 5 THEN (mid_self_score * 111 + 222)
    ELSE mid_self_score
  END,
  end_self_score = CASE
    WHEN end_self_score IS NOT NULL AND end_self_score <= 5 THEN (end_self_score * 111 + 222)
    ELSE end_self_score
  END,
  end_pm_score = CASE
    WHEN end_pm_score IS NOT NULL AND end_pm_score <= 5 THEN (end_pm_score * 111 + 222)
    ELSE end_pm_score
  END,
  end_gm_score = CASE
    WHEN end_gm_score IS NOT NULL AND end_gm_score <= 5 THEN (end_gm_score * 111 + 222)
    ELSE end_gm_score
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND (
    (mid_self_score IS NOT NULL AND mid_self_score <= 5)
    OR (end_self_score IS NOT NULL AND end_self_score <= 5)
    OR (end_pm_score IS NOT NULL AND end_pm_score <= 5)
    OR (end_gm_score IS NOT NULL AND end_gm_score <= 5)
  );

