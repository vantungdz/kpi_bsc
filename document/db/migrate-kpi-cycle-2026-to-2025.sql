-- ============================================================================
-- Chuyển toàn bộ KPI năm 2026 → năm 2025 (KHÔNG đụng KPI template)
--
-- Cập nhật: kpis_information, kpi_assignments (+ partition),
--           kpi_assignment_snapshots, kpi_assignment_feedbacks,
--           user_kpi_summaries
--
-- Không đổi: kpi_templates, kpi_template_items, kpi_master,
--             performance_rating_levels, bản ghi kpi_cycles
--
-- Trước khi chạy: BACKUP DB → chạy khối KIỂM TRA TRƯỚC (comment block)
-- Mặc định ROLLBACK ở cuối; đổi thành COMMIT khi đã OK.
-- ============================================================================

-- --------------------------------------------------------------------------
-- KIỂM TRA TRƯỚC (bỏ comment /* */ rồi chạy riêng)
-- --------------------------------------------------------------------------
/*
SELECT id, year, name, status_code
FROM kpi_cycles
WHERE year IN (2025, 2026) AND deleted_at IS NULL
ORDER BY year;

SELECT 'kpis_information' AS tbl, COUNT(*) AS cnt
FROM kpis_information ki
JOIN kpi_cycles c ON c.id = ki.cycle_id AND c.year = 2026 AND c.deleted_at IS NULL
WHERE ki.deleted_at IS NULL
UNION ALL
SELECT 'kpi_assignments', COUNT(*)
FROM kpi_assignments ka
JOIN kpi_cycles c ON c.id = ka.cycle_id AND c.year = 2026 AND c.deleted_at IS NULL
WHERE ka.deleted_at IS NULL
UNION ALL
SELECT 'user_kpi_summaries', COUNT(*)
FROM user_kpi_summaries uks
JOIN kpi_cycles c ON c.id = uks.cycle_id AND c.year = 2026 AND c.deleted_at IS NULL
WHERE uks.deleted_at IS NULL;

SELECT ki26.master_kpi_id, ki26.id AS info_2026, ki25.id AS info_2025
FROM kpis_information ki26
JOIN kpi_cycles c26 ON c26.id = ki26.cycle_id AND c26.year = 2026 AND c26.deleted_at IS NULL
JOIN kpis_information ki25
    ON ki25.master_kpi_id = ki26.master_kpi_id AND ki25.deleted_at IS NULL
JOIN kpi_cycles c25 ON c25.id = ki25.cycle_id AND c25.year = 2025 AND c25.deleted_at IS NULL
WHERE ki26.deleted_at IS NULL;
*/

BEGIN;

DO $$
DECLARE
    v_source_year   INTEGER := 2026;
    v_target_year   INTEGER := 2025;
    v_source_id     UUID;
    v_target_id     UUID;
    v_merged_ki     INTEGER;
    v_moved_ki      INTEGER;
    v_moved_asm     INTEGER;
    v_moved_fb      INTEGER;
    v_moved_snap    INTEGER;
    v_moved_summary INTEGER;
    v_dup_summary   INTEGER;
    v_left_ki_2026  BIGINT;
    v_left_asm_2026 BIGINT;
    v_total_ki_2025 BIGINT;
    v_total_asm_2025 BIGINT;
BEGIN
    SELECT id INTO v_source_id
    FROM kpi_cycles
    WHERE year = v_source_year AND deleted_at IS NULL
    LIMIT 1;

    SELECT id INTO v_target_id
    FROM kpi_cycles
    WHERE year = v_target_year AND deleted_at IS NULL
    LIMIT 1;

    IF v_source_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy kpi_cycles năm %.', v_source_year;
    END IF;
    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy kpi_cycles năm %.', v_target_year;
    END IF;
    IF v_source_id = v_target_id THEN
        RAISE EXCEPTION 'source và target trùng cycle_id.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_inherits i
        JOIN pg_class child ON child.oid = i.inhrelid
        JOIN pg_class parent ON parent.oid = i.inhparent AND parent.relname = 'kpi_assignments'
        WHERE pg_get_expr(child.relpartbound, child.oid) LIKE '%' || v_target_id::text || '%'
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS kpi_assignments_%s PARTITION OF kpi_assignments FOR VALUES IN (%L)',
            v_target_year, v_target_id);
        RAISE NOTICE 'Đã tạo partition kpi_assignments_%', v_target_year;
    END IF;

    RAISE NOTICE 'Chuyển KPI: % (%) → % (%)', v_source_year, v_source_id, v_target_year, v_target_id;

    -- 1) Trùng master_kpi_id: assignment trỏ sang kpis_information 2025, xóa bản 2026
    UPDATE kpi_assignments ka
    SET kpi_info_id = ki25.id,
        updated_at  = CURRENT_TIMESTAMP
    FROM kpis_information ki26
    JOIN kpis_information ki25
        ON ki25.master_kpi_id = ki26.master_kpi_id
       AND ki25.cycle_id = v_target_id
       AND ki25.deleted_at IS NULL
    WHERE ki26.cycle_id = v_source_id
      AND ki26.deleted_at IS NULL
      AND ka.kpi_info_id = ki26.id
      AND ka.cycle_id = v_source_id;

    GET DIAGNOSTICS v_merged_ki = ROW_COUNT;

    DELETE FROM kpis_information ki26
    WHERE ki26.cycle_id = v_source_id
      AND ki26.deleted_at IS NULL
      AND EXISTS (
          SELECT 1 FROM kpis_information ki25
          WHERE ki25.master_kpi_id = ki26.master_kpi_id
            AND ki25.cycle_id = v_target_id
            AND ki25.deleted_at IS NULL
      );

    UPDATE kpis_information
    SET cycle_id   = v_target_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE cycle_id = v_source_id
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_moved_ki = ROW_COUNT;

    -- 2) user_kpi_summaries: xóa bản 2025 trùng user (tránh UNIQUE user+cycle)
    DELETE FROM user_kpi_summaries uks25
    USING user_kpi_summaries uks26
    WHERE uks25.cycle_id = v_target_id
      AND uks25.deleted_at IS NULL
      AND uks26.cycle_id = v_source_id
      AND uks26.user_id = uks25.user_id
      AND uks26.deleted_at IS NULL;

    GET DIAGNOSTICS v_dup_summary = ROW_COUNT;

    UPDATE user_kpi_summaries
    SET cycle_id   = v_target_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE cycle_id = v_source_id
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_moved_summary = ROW_COUNT;

    -- 3) Assignments + con (tạm bỏ FK composite — partition LIST)
    ALTER TABLE kpi_assignment_feedbacks
        DROP CONSTRAINT IF EXISTS fk_feedback_assignment;

    ALTER TABLE kpi_assignment_snapshots
        DROP CONSTRAINT IF EXISTS fk_kpi_assignment_snapshot_assignment;

    UPDATE kpi_assignments
    SET cycle_id   = v_target_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE cycle_id = v_source_id;

    GET DIAGNOSTICS v_moved_asm = ROW_COUNT;

    UPDATE kpi_assignment_feedbacks
    SET cycle_id = v_target_id
    WHERE cycle_id = v_source_id;

    GET DIAGNOSTICS v_moved_fb = ROW_COUNT;

    UPDATE kpi_assignment_snapshots
    SET cycle_id = v_target_id
    WHERE cycle_id = v_source_id;

    GET DIAGNOSTICS v_moved_snap = ROW_COUNT;

    ALTER TABLE kpi_assignment_snapshots
        ADD CONSTRAINT fk_kpi_assignment_snapshot_assignment
        FOREIGN KEY (assignment_id, cycle_id)
        REFERENCES kpi_assignments(id, cycle_id)
        ON DELETE CASCADE;

    ALTER TABLE kpi_assignment_feedbacks
        ADD CONSTRAINT fk_feedback_assignment
        FOREIGN KEY (assignment_id, cycle_id)
        REFERENCES kpi_assignments(id, cycle_id)
        ON DELETE CASCADE;

    RAISE NOTICE 'assignments remapped (dup master_kpi): %', v_merged_ki;
    RAISE NOTICE 'kpis_information moved: %', v_moved_ki;
    RAISE NOTICE 'user_kpi_summaries 2025 removed (dup user): %', v_dup_summary;
    RAISE NOTICE 'user_kpi_summaries moved: %', v_moved_summary;
    RAISE NOTICE 'kpi_assignments moved: %', v_moved_asm;
    RAISE NOTICE 'kpi_assignment_feedbacks moved: %', v_moved_fb;
    RAISE NOTICE 'kpi_assignment_snapshots moved: %', v_moved_snap;

    -- Kiểm tra trong cùng transaction (hiện trên tab Messages / NOTICE)
    SELECT COUNT(*) INTO v_left_ki_2026
    FROM kpis_information ki
    WHERE ki.cycle_id = v_source_id AND ki.deleted_at IS NULL;

    SELECT COUNT(*) INTO v_left_asm_2026
    FROM kpi_assignments ka
    WHERE ka.cycle_id = v_source_id AND ka.deleted_at IS NULL;

    SELECT COUNT(*) INTO v_total_ki_2025
    FROM kpis_information ki
    WHERE ki.cycle_id = v_target_id AND ki.deleted_at IS NULL;

    SELECT COUNT(*) INTO v_total_asm_2025
    FROM kpi_assignments ka
    WHERE ka.cycle_id = v_target_id AND ka.deleted_at IS NULL;

    RAISE NOTICE '=== KIỂM TRA SAU (trong transaction) ===';
    RAISE NOTICE 'kpis_information_2026_left = % (kỳ vọng 0)', v_left_ki_2026;
    RAISE NOTICE 'kpi_assignments_2026_left = % (kỳ vọng 0)', v_left_asm_2026;
    RAISE NOTICE 'kpis_information_2025_total = %', v_total_ki_2025;
    RAISE NOTICE 'kpi_assignments_2025_total = %', v_total_asm_2025;

    IF v_left_ki_2026 > 0 OR v_left_asm_2026 > 0 THEN
        RAISE EXCEPTION
            'Còn dữ liệu 2026: kpis_information=%, kpi_assignments=%. Không COMMIT.',
            v_left_ki_2026, v_left_asm_2026;
    END IF;
END $$;

-- Đổi ROLLBACK → COMMIT khi NOTICE "KIỂM TRA SAU" đều OK
COMMIT;
ROLLBACK;

-- --------------------------------------------------------------------------
-- SAU KHI COMMIT: chạy riêng để xác nhận trên DB thật
-- --------------------------------------------------------------------------
/*
SELECT 'kpis_information_2026_left' AS check_name, COUNT(*) AS cnt
FROM kpis_information ki
JOIN kpi_cycles c ON c.id = ki.cycle_id AND c.year = 2026 AND c.deleted_at IS NULL
WHERE ki.deleted_at IS NULL
UNION ALL
SELECT 'kpi_assignments_2026_left', COUNT(*)
FROM kpi_assignments ka
JOIN kpi_cycles c ON c.id = ka.cycle_id AND c.year = 2026 AND c.deleted_at IS NULL
WHERE ka.deleted_at IS NULL
UNION ALL
SELECT 'kpis_information_2025_total', COUNT(*)
FROM kpis_information ki
JOIN kpi_cycles c ON c.id = ki.cycle_id AND c.year = 2025 AND c.deleted_at IS NULL
WHERE ki.deleted_at IS NULL
UNION ALL
SELECT 'kpi_assignments_2025_total', COUNT(*)
FROM kpi_assignments ka
JOIN kpi_cycles c ON c.id = ka.cycle_id AND c.year = 2025 AND c.deleted_at IS NULL
WHERE ka.deleted_at IS NULL;
*/
