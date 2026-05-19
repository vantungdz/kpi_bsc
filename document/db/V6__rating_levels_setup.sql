-- ============================================================================
-- V6: Khung điểm đánh giá GM — migration schema + dữ liệu mẫu
--
-- Chạy SAU: init-db.sql (+ V3__sample_data.sql nếu cần kpi_cycles 2025/2026)
-- Hướng dẫn: document/db/RATING_LEVELS_SETUP.md
--
-- Gồm: gộp bảng performance_rating_scales vào kpi_cycles + seed 9 mức/năm
-- An toàn chạy lại: IF NOT EXISTS, ON CONFLICT DO NOTHING
-- ============================================================================

-- --------------------------------------------------------------------------
-- PHẦN 1 — SCHEMA (DB cũ còn performance_rating_scales / scale_id)
-- DB mới (init-db.sql): phần này gần như no-op
-- --------------------------------------------------------------------------

ALTER TABLE performance_rating_levels
    ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES kpi_cycles(id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'performance_rating_scales'
    ) THEN
        ALTER TABLE performance_rating_scales
            ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES kpi_cycles(id);

        UPDATE performance_rating_scales s
        SET cycle_id = c.id
        FROM kpi_cycles c
        WHERE s.cycle_id IS NULL
          AND c.year = s.year
          AND c.deleted_at IS NULL
          AND s.deleted_at IS NULL;

        INSERT INTO kpi_cycles (id, year, name, status_code) VALUES
            ('c2000000-0000-0000-0000-000000000003', 2024, 'Năm 2024', 202)
        ON CONFLICT DO NOTHING;

        UPDATE performance_rating_scales s
        SET cycle_id = 'c2000000-0000-0000-0000-000000000003'::uuid
        WHERE s.year = 2024
          AND s.cycle_id IS NULL
          AND s.deleted_at IS NULL;

        UPDATE performance_rating_levels l
        SET cycle_id = s.cycle_id
        FROM performance_rating_scales s
        WHERE l.cycle_id IS NULL
          AND l.scale_id = s.id
          AND s.cycle_id IS NOT NULL;

        UPDATE performance_rating_levels l
        SET cycle_id = c.id
        FROM performance_rating_scales s
        INNER JOIN kpi_cycles c
            ON c.year = s.year AND c.deleted_at IS NULL
        WHERE l.cycle_id IS NULL
          AND l.scale_id = s.id;

        UPDATE performance_rating_levels l
        SET cycle_id = COALESCE(s.cycle_id, c.id)
        FROM performance_rating_scales s
        LEFT JOIN kpi_cycles c
            ON c.year = s.year AND c.deleted_at IS NULL
        WHERE l.cycle_id IS NULL
          AND l.scale_id = s.id
          AND COALESCE(s.cycle_id, c.id) IS NOT NULL;
    END IF;
END $$;

DELETE FROM performance_rating_levels
WHERE cycle_id IS NULL;

DO $$
DECLARE
    orphan_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM performance_rating_levels
    WHERE cycle_id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
            'Còn % dòng performance_rating_levels.cycle_id IS NULL. '
            'Chạy: SELECT id, scale_id, deleted_at FROM performance_rating_levels WHERE cycle_id IS NULL',
            orphan_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'performance_rating_levels'
          AND column_name = 'cycle_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE performance_rating_levels
            ALTER COLUMN cycle_id SET NOT NULL;
    END IF;
END $$;

ALTER TABLE performance_rating_levels
    DROP CONSTRAINT IF EXISTS performance_rating_levels_scale_id_fkey;

DROP INDEX IF EXISTS idx_performance_rating_levels_scale_code_active;
DROP INDEX IF EXISTS idx_performance_rating_levels_scale_order_active;
DROP INDEX IF EXISTS idx_performance_rating_levels_scale_id;

ALTER TABLE performance_rating_levels
    DROP COLUMN IF EXISTS scale_id;

DROP TABLE IF EXISTS performance_rating_scales CASCADE;

DROP INDEX IF EXISTS idx_performance_rating_scales_year_active;
DROP INDEX IF EXISTS idx_performance_rating_scales_cycle_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_rating_levels_cycle_code_active
    ON performance_rating_levels(cycle_id, level_code) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_rating_levels_cycle_order_active
    ON performance_rating_levels(cycle_id, sort_order) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_performance_rating_levels_cycle_id
    ON performance_rating_levels(cycle_id) WHERE deleted_at IS NULL;

-- --------------------------------------------------------------------------
-- PHẦN 2 — DỮ LIỆU MẪU: 9 mức / năm (2024, 2025, 2026)
-- --------------------------------------------------------------------------

INSERT INTO kpi_cycles (id, year, name, status_code) VALUES
    ('c2000000-0000-0000-0000-000000000003', 2024, 'Năm 2024', 202)
ON CONFLICT DO NOTHING;

INSERT INTO performance_rating_levels
    (id, cycle_id, sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier)
VALUES
    ('b1000000-0000-0000-0000-000000000101', 'c2000000-0000-0000-0000-000000000003', 0, 'NA', '<= 2.59 (N/A)', 0.00, 2.59, 0, '#f43f5e', false),
    ('b1000000-0000-0000-0000-000000000102', 'c2000000-0000-0000-0000-000000000003', 1, 'D',  '2.60-2.99 (D)', 2.60, 2.99, 0.5, '#fb923c', false),
    ('b1000000-0000-0000-0000-000000000103', 'c2000000-0000-0000-0000-000000000003', 2, 'C2', '3.00-3.10 (C2)', 3.00, 3.10, 3.9, '#94a3b8', false),
    ('b1000000-0000-0000-0000-000000000104', 'c2000000-0000-0000-0000-000000000003', 3, 'C1', '3.11-3.20 (C1)', 3.11, 3.20, 5, '#64748b', false),
    ('b1000000-0000-0000-0000-000000000105', 'c2000000-0000-0000-0000-000000000003', 4, 'B2', '3.21-3.30 (B2)', 3.21, 3.30, 6.7, '#a78bfa', false),
    ('b1000000-0000-0000-0000-000000000106', 'c2000000-0000-0000-0000-000000000003', 5, 'B1', '3.31-3.40 (B1)', 3.31, 3.40, 8.4, '#818cf8', false),
    ('b1000000-0000-0000-0000-000000000107', 'c2000000-0000-0000-0000-000000000003', 6, 'A2', '3.41-3.50 (A2)', 3.41, 3.50, 9.5, '#3b82f6', true),
    ('b1000000-0000-0000-0000-000000000108', 'c2000000-0000-0000-0000-000000000003', 7, 'A1', '3.51-3.60 (A1)', 3.51, 3.60, 11, '#14b8a6', true),
    ('b1000000-0000-0000-0000-000000000109', 'c2000000-0000-0000-0000-000000000003', 8, 'O1', '>= 3.61 (O1)', 3.61, NULL, 12.5, '#059669', true)
ON CONFLICT DO NOTHING;

INSERT INTO performance_rating_levels
    (id, cycle_id, sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier)
SELECT
    id::uuid,
    'c2000000-0000-0000-0000-000000000002'::uuid,
    sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier
FROM (VALUES
    ('b2000000-0000-0000-0000-000000000101', 0, 'NA', '<= 2.59 (N/A)', 0.00, 2.59, 0, '#f43f5e', false),
    ('b2000000-0000-0000-0000-000000000102', 1, 'D',  '2.60-2.99 (D)', 2.60, 2.99, 0.5, '#fb923c', false),
    ('b2000000-0000-0000-0000-000000000103', 2, 'C2', '3.00-3.10 (C2)', 3.00, 3.10, 3.9, '#94a3b8', false),
    ('b2000000-0000-0000-0000-000000000104', 3, 'C1', '3.11-3.20 (C1)', 3.11, 3.20, 5, '#64748b', false),
    ('b2000000-0000-0000-0000-000000000105', 4, 'B2', '3.21-3.30 (B2)', 3.21, 3.30, 6.7, '#a78bfa', false),
    ('b2000000-0000-0000-0000-000000000106', 5, 'B1', '3.31-3.40 (B1)', 3.31, 3.40, 8.4, '#818cf8', false),
    ('b2000000-0000-0000-0000-000000000107', 6, 'A2', '3.41-3.50 (A2)', 3.41, 3.50, 9.5, '#3b82f6', true),
    ('b2000000-0000-0000-0000-000000000108', 7, 'A1', '3.51-3.60 (A1)', 3.51, 3.60, 11, '#14b8a6', true),
    ('b2000000-0000-0000-0000-000000000109', 8, 'O1', '>= 3.61 (O1)', 3.61, NULL, 12.5, '#059669', true)
) AS t(id, sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier)
ON CONFLICT DO NOTHING;

INSERT INTO performance_rating_levels
    (id, cycle_id, sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier)
SELECT
    id::uuid,
    'c2000000-0000-0000-0000-000000000001'::uuid,
    sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier
FROM (VALUES
    ('b3000000-0000-0000-0000-000000000101', 0, 'NA', '<= 2.59 (N/A)', 0.00, 2.59, 0, '#f43f5e', false),
    ('b3000000-0000-0000-0000-000000000102', 1, 'D',  '2.60-2.99 (D)', 2.60, 2.99, 0.5, '#fb923c', false),
    ('b3000000-0000-0000-0000-000000000103', 2, 'C2', '3.00-3.10 (C2)', 3.00, 3.10, 3.9, '#94a3b8', false),
    ('b3000000-0000-0000-0000-000000000104', 3, 'C1', '3.11-3.20 (C1)', 3.11, 3.20, 5, '#64748b', false),
    ('b3000000-0000-0000-0000-000000000105', 4, 'B2', '3.21-3.30 (B2)', 3.21, 3.30, 6.7, '#a78bfa', false),
    ('b3000000-0000-0000-0000-000000000106', 5, 'B1', '3.31-3.40 (B1)', 3.31, 3.40, 8.4, '#818cf8', false),
    ('b3000000-0000-0000-0000-000000000107', 6, 'A2', '3.41-3.50 (A2)', 3.41, 3.50, 9.5, '#3b82f6', true),
    ('b3000000-0000-0000-0000-000000000108', 7, 'A1', '3.51-3.60 (A1)', 3.51, 3.60, 11, '#14b8a6', true),
    ('b3000000-0000-0000-0000-000000000109', 8, 'O1', '>= 3.61 (O1)', 3.61, NULL, 12.5, '#059669', true)
) AS t(id, sort_order, level_code, label, min_score, max_score, pitch, color_hex, is_top_tier)
ON CONFLICT DO NOTHING;
