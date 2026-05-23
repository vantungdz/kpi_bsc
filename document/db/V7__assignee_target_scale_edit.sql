-- Cho phép member/PM (khi được GM giao) sửa target và thang điểm trên từng assignment.
ALTER TABLE kpis_information
    ADD COLUMN IF NOT EXISTS allow_assignee_target_scale_edit BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE kpi_assignments
    ADD COLUMN IF NOT EXISTS scoring_scale JSONB;

COMMENT ON COLUMN kpis_information.allow_assignee_target_scale_edit IS
    'Khi TRUE: người nhận assignment có thể sửa target_value và scoring_scale trên dòng assignment của mình.';
COMMENT ON COLUMN kpi_assignments.scoring_scale IS
    'Thang điểm (JSON) theo assignment; copy từ kpis_information.target_description khi giao, hoặc từ assignment cha khi cascade.';
