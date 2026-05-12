-- Chạy trên DB đã tồn tại (bổ sung cột tách nhận xét Promotion vs KPI Member).
ALTER TABLE user_kpi_summaries
    ADD COLUMN IF NOT EXISTS evaluation_comments_promotion TEXT,
    ADD COLUMN IF NOT EXISTS evaluation_supervisor_comments_promotion TEXT;
