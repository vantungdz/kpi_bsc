-- Mốc target + thang điểm trước khi assignee sửa (so với target_value / scoring_scale hiện tại khi PM/GM duyệt).
ALTER TABLE kpi_assignments
    ADD COLUMN IF NOT EXISTS assignee_edit_baseline_target NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS assignee_edit_baseline_scoring JSONB,
    ADD COLUMN IF NOT EXISTS assignee_edit_baseline_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assignee_edit_baseline_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN kpi_assignments.assignee_edit_baseline_target IS
    'Target tại mốc trước lần Save đầu của assignee (diff với target_value).';
COMMENT ON COLUMN kpi_assignments.assignee_edit_baseline_scoring IS
    'Thang điểm tại mốc trước lần Save đầu (diff với scoring_scale).';
COMMENT ON COLUMN kpi_assignments.assignee_edit_baseline_at IS
    'Thời điểm chốt baseline.';
COMMENT ON COLUMN kpi_assignments.assignee_edit_baseline_by IS
    'User kích hoạt chốt baseline (thường assignee Save lần đầu).';
