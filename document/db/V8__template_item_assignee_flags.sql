-- Cờ KPI mẫu: quan trọng + cho phép người nhận sửa target/thang điểm khi áp dụng vào chu kỳ.
ALTER TABLE kpi_template_items
    ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE kpi_template_items
    ADD COLUMN IF NOT EXISTS allow_assignee_target_scale_edit BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN kpi_template_items.is_important IS
    'KPI quan trọng — copy sang kpis_information khi tạo KPI từ template.';
COMMENT ON COLUMN kpi_template_items.allow_assignee_target_scale_edit IS
    'Cho phép người nhận assignment sửa target_value và scoring_scale — copy sang kpis_information.';

-- Lý do PM/GM từ chối đánh giá (ASM 504 / 604).
ALTER TABLE kpi_assignments
    ADD COLUMN IF NOT EXISTS evaluation_reject_reason TEXT;

COMMENT ON COLUMN kpi_assignments.evaluation_reject_reason IS
    'Lý do từ chối đánh giá giữa kỳ/cuối kỳ (501/502→504, 601/602→604). Khác update_reason (đề xuất KPI 406).';
