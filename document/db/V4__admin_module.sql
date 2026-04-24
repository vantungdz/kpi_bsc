-- ============================================================================
-- V4__admin_module.sql
-- Thêm bảng email_templates, ADMIN role và admin user cho module Admin
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Tạo bảng email_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(255) NOT NULL,
    subject        VARCHAR(500) NOT NULL,
    body           TEXT         NOT NULL,
    status         VARCHAR(20)  DEFAULT 'active'
                       CHECK (status IN ('active', 'inactive')),
    send_mode      VARCHAR(20)  DEFAULT 'manual'
                       CHECK (send_mode IN ('manual', 'auto')),
    template_group VARCHAR(50)  DEFAULT 'launch'
                       CHECK (template_group IN ('launch', 'reminder', 'approval')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by     UUID REFERENCES users(id),
    updated_by     UUID REFERENCES users(id),
    deleted_at     TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_email_templates_group
    ON email_templates(template_group) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. Thêm ADMIN role
-- ============================================================================
INSERT INTO roles (id, code, name) VALUES
  ('a1000000-0000-0000-0000-000000000005', 'ADMIN', 'System Administrator')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. Thêm Admin user (admin@company.vn / Abc@12345)
--    BCrypt hash tương tự các user mẫu trong V3
-- ============================================================================
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000050',
   'admin',
   'admin@company.vn',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'System Admin',
   NULL,
   true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Gán ADMIN role cho admin user
-- ============================================================================
INSERT INTO user_roles (user_id, role_id) VALUES
  ('e1000000-0000-0000-0000-000000000050', 'a1000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. Dữ liệu mẫu cho email_templates
-- ============================================================================
INSERT INTO email_templates (id, name, subject, body, status, send_mode, template_group) VALUES
(
  'f2000000-0000-0000-0000-000000000001',
  'Thông báo Mở kỳ Đánh giá KPI',
  '[Thông báo] Yêu cầu thực hiện Đánh giá KPI ({{KPI_Period}})',
  E'Kính gửi anh/chị {{Employee_Name}},\n\nHệ thống Đánh giá KPI cho kỳ {{KPI_Period}} đã chính thức được mở.\nAnh/chị vui lòng đăng nhập vào hệ thống để cập nhật kết quả KPI cá nhân.\n\nHạn chót: {{Deadline_Date}}\nTruy cập: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team',
  'active', 'manual', 'launch'
),
(
  'f2000000-0000-0000-0000-000000000002',
  'Nhắc nhở Trước Deadline 7 ngày',
  '[Nhắc nhở] Còn 7 ngày để hoàn thành đánh giá KPI ({{KPI_Period}})',
  E'Kính gửi anh/chị {{Employee_Name}},\n\nHệ thống ghi nhận còn {{Missing_Count}} mục KPI cần cập nhật bằng chứng.\nHạn chót: {{Deadline_Date}}\nTruy cập: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team',
  'active', 'auto', 'reminder'
),
(
  'f2000000-0000-0000-0000-000000000003',
  'Nhắc nhở Trước Deadline 1 ngày',
  '[KHẨN] Còn 1 ngày để hoàn thành đánh giá KPI ({{KPI_Period}})',
  E'Kính gửi anh/chị {{Employee_Name}},\n\nĐây là lời nhắc cuối cùng. Anh/chị còn {{Missing_Count}} mục KPI chưa nộp bằng chứng.\nHạn chót hôm nay: {{Deadline_Date}}\nTruy cập: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team',
  'active', 'auto', 'reminder'
),
(
  'f2000000-0000-0000-0000-000000000004',
  'Cảnh báo Quá hạn Đánh giá',
  '[QUÁ HẠN] Chưa nộp kết quả đánh giá KPI — {{Employee_Name}}',
  E'Kính gửi anh/chị {{Employee_Name}},\n\nAnh/chị đã quá hạn nộp kết quả đánh giá KPI kỳ {{KPI_Period}}.\nVui lòng liên hệ HR để được hỗ trợ.\n\nTrân trọng,\nHR & Admin Team',
  'active', 'auto', 'reminder'
),
(
  'f2000000-0000-0000-0000-000000000005',
  'Yêu cầu Cập nhật lại Bằng chứng',
  '[Yêu cầu] Cần cập nhật lại bằng chứng KPI — {{Employee_Name}}',
  E'Kính gửi anh/chị {{Employee_Name}},\n\nQuản lý trực tiếp yêu cầu bạn cập nhật lại bằng chứng KPI với lý do:\n"{{Manager_Comment}}"\n\nTruy cập: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team',
  'active', 'manual', 'reminder'
),
(
  'f2000000-0000-0000-0000-000000000006',
  'Thông báo Kết quả Đánh giá đã được Duyệt',
  '[Thông báo] Kết quả Đánh giá KPI kỳ {{KPI_Period}} đã được chốt',
  E'Kính gửi anh/chị {{Employee_Name}},\n\nGM đã chính thức chốt điểm KPI kỳ {{KPI_Period}}.\nAnh/chị vui lòng đăng nhập để xem kết quả đánh giá.\n\nTruy cập: {{System_URL}}\n\nTrân trọng,\nHR & Admin Team',
  'active', 'auto', 'approval'
)
ON CONFLICT DO NOTHING;
