CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MODULE 0: SYSTEM MASTER CODES (TỪ ĐIỂN MÃ SỐ TYPE/STATUS)
-- ============================================================================
DROP TABLE IF EXISTS sys_status_codes CASCADE;

CREATE TABLE sys_status_codes (
    code INTEGER PRIMARY KEY,          -- Mã số (PK)
    category VARCHAR(50) NOT NULL,     -- Nhóm (KPI_TYPE, CYCLE_STATUS, ASM_STATUS...)
    name VARCHAR(100) NOT NULL,        -- Tên hiển thị (Dành cho UI/Backend map Enum)
    description TEXT,
    
    -- [MỚI]: Thêm Audit & Soft Delete
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index để tối ưu khi Backend query theo Category (VD: Lấy list trạng thái để vẽ Dropdown)
CREATE INDEX idx_sys_status_category ON sys_status_codes(category) WHERE deleted_at IS NULL;


-- ============================================================================
-- INSERT DỮ LIỆU ĐÃ ĐƯỢC CHUẨN HÓA LẠI THEO HỆ 100
-- ============================================================================
INSERT INTO sys_status_codes (code, category, name, description) VALUES
-- 1xx: KPI TYPE
(101, 'KPI_TYPE', 'INDIVIDUAL', 'Mục tiêu cá nhân'),
(102, 'KPI_TYPE', 'TEAM', 'Mục tiêu phòng ban/nhóm'),
(103, 'KPI_TYPE', 'PROMOTION', 'Mục tiêu thăng tiến'),

-- 2xx: CYCLE STATUS
(201, 'CYCLE_STATUS', 'OPEN', 'Chu kỳ đang mở'),
(202, 'CYCLE_STATUS', 'CLOSED', 'Chu kỳ đã đóng'),

-- ==========================================
-- ASM_STATUS (Luồng vận hành All-in-One)
-- ==========================================
-- 4xx: Phase 1 (Giao việc & Xin đổi)
(401, 'ASM_STATUS', 'INACTIVE', 'KPI mới tạo (Chưa kích hoạt)'),
(402, 'ASM_STATUS', 'WAITING_PM_APPROVAL', 'Chờ PM duyệt KPI'),
(403, 'ASM_STATUS', 'WAITING_GM_APPROVAL', 'Chờ GM duyệt KPI'),
(404, 'ASM_STATUS', 'PENDING_ACCEPTANCE', 'Chờ Member bấm Accept'),
(405, 'ASM_STATUS', 'ACCEPTED', 'Đã chốt mục tiêu (Đang chạy)'),
(406, 'ASM_STATUS', 'REJECTED', 'Bị từ chối'),
(407, 'ASM_STATUS', 'FEEDBACK_IN_PROGRESS', 'Kiểm tra feedback'),

-- 5xx: Phase 2 (Đánh giá 1st Half)
(501, 'ASM_STATUS', '1ST_WAITING_PM_APPROVAL', 'Member đã nộp bằng chứng 1st Half, chờ PM duyệt'),
(502, 'ASM_STATUS', '1ST_WAITING_GM_APPROVAL', 'PM đã duyệt 1st Half, chờ GM chốt điểm'),
(503, 'ASM_STATUS', '1ST_COMPLETED', 'GM đã chốt điểm 1st Half'),

-- 6xx: Phase 3 (Đánh giá 2nd Half & Final)
(601, 'ASM_STATUS', '2ND_WAITING_PM_APPROVAL', 'Chờ PM chấm điểm Final'),
(602, 'ASM_STATUS', '2ND_WAITING_GM_APPROVAL', 'Chờ GM chốt điểm Final'),
(603, 'ASM_STATUS', 'COMPLETED', 'Đã chốt sổ hoàn toàn (Kết thúc vòng đời)'),

-- 7xx: CALC_TYPE (Chiều hướng tính toán & So sánh)
(701, 'CALC_TYPE', 'ACTUAL_OVER_PLAN', 'Actual / Plan'),
(702, 'CALC_TYPE', 'PLAN_OVER_ACTUAL', 'Plan / Actual'),

-- 8xx: CALC_RULE (Quy tắc tổng hợp điểm)
(802, 'CALC_RULE', 'AVERAGE', 'Lấy trung bình cộng điểm các KPI con'),
(803, 'CALC_RULE', 'COMMENT', 'Nhập điểm thủ công dựa trên nhận xét đánh giá'),

-- 9xx: KPI_UNIT (Đơn vị tính của Chỉ tiêu)
(901, 'KPI_UNIT', 'MM', 'Man-Month'),
(902, 'KPI_UNIT', 'Percent', 'Phần trăm (%)'),
(903, 'KPI_UNIT', 'Point', 'Điểm số'),
(904, 'KPI_UNIT', 'Product', 'Sản phẩm'),
(905, 'KPI_UNIT', 'Project', 'Dự án'),
(906, 'KPI_UNIT', 'Certification', 'Chứng chỉ'),
(907, 'KPI_UNIT', 'Article', 'Bài viết / Bài báo'),
(908, 'KPI_UNIT', 'Person', 'Người / Nhân sự');

-- ============================================================================
-- MODULE 1 & 2: CƠ CẤU CHỨC DANH, TỔ CHỨC & USERS
-- ============================================================================
CREATE TABLE job_families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL, 
    name VARCHAR(100) NOT NULL,       
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_families_code_active ON job_families(code) WHERE deleted_at IS NULL;

CREATE TABLE ranks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,       
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_ranks_code_active ON ranks(code) WHERE deleted_at IS NULL;

CREATE TABLE job_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_family_id UUID REFERENCES job_families(id) NOT NULL,
    rank_id UUID REFERENCES ranks(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_job_titles_unique_active ON job_titles(job_family_id, rank_id) WHERE deleted_at IS NULL;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL, 
    email VARCHAR(255) NOT NULL,    
    password_hash VARCHAR(255),     
    full_name character varying(200),
    job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL, 
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_unique_active_username ON users(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_unique_active_email ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT FALSE,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL, 
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,     
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_departments_parent ON departments(parent_id) WHERE deleted_at IS NULL;

CREATE TABLE user_departments (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_primary BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, department_id)
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_roles_code_active ON roles(code) WHERE deleted_at IS NULL;

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================================
-- MODULE 3: MASTER DATA KPI, TEMPLATES & CHU KỲ (REFER CODE TỪ MODULE 0)
-- ============================================================================
DROP TABLE IF EXISTS kpi_cycles CASCADE;
CREATE TABLE kpi_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    goal_setting_start TIMESTAMP WITH TIME ZONE,
    goal_setting_end TIMESTAMP WITH TIME ZONE,
    mid_year_start TIMESTAMP WITH TIME ZONE,
    mid_year_end TIMESTAMP WITH TIME ZONE,
    end_year_start TIMESTAMP WITH TIME ZONE,
    end_year_end TIMESTAMP WITH TIME ZONE,
    
    -- Tham chiếu bằng CODE (Mặc định 10: OPEN)
    status_code INTEGER REFERENCES sys_status_codes(code) DEFAULT 201,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_kpi_cycles_year_active ON kpi_cycles(year) WHERE deleted_at IS NULL;

CREATE TABLE kpi_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3.1 BẢNG MASTER VĨNH CỬU XUYÊN NĂM
CREATE TABLE kpi_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50), 
    name VARCHAR(255) NOT NULL, 
    category_id UUID REFERENCES kpi_categories(id),
    
    -- Tham chiếu type bằng CODE
    type_code INTEGER REFERENCES sys_status_codes(code) NOT NULL,

    calculation_rule_code INTEGER REFERENCES sys_status_codes(code) DEFAULT 801,

    -- [Cập nhật]: Có thể NULL vì không phải lúc nào cũng dùng công thức chia
    calculation_type_code INTEGER REFERENCES sys_status_codes(code),

    -- Thêm cột Đơn vị tính (Tham chiếu CODE từ sys_status_codes)
    unit_code INTEGER REFERENCES sys_status_codes(code),

    -- Cờ phân luồng: TRUE (Hàng công ty GM giao), FALSE (Member tự đề xuất)
    is_global BOOLEAN DEFAULT TRUE, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3.2 BẢNG TEMPLATE ĐỂ TÁI SỬ DỤNG
CREATE TABLE kpi_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, 
    description TEXT,
    job_family_id UUID REFERENCES job_families(id),
    rank_id UUID REFERENCES ranks(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE kpi_template_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES kpi_templates(id) ON DELETE CASCADE,
    master_kpi_id UUID REFERENCES kpi_master(id),
    default_target_value NUMERIC(10,2),
    default_weight NUMERIC(5,2),
    default_target_description JSONB,
    UNIQUE(template_id, master_kpi_id)
);

-- 3.3 BẢNG THƯ VIỆN CỦA TỪNG NĂM CỤ THỂ
CREATE TABLE kpis_information (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES kpi_cycles(id) NOT NULL, 
    master_kpi_id UUID REFERENCES kpi_master(id) NOT NULL,
    
    target_description JSONB,
    target_value NUMERIC(10,2),   
    weight NUMERIC(5,2),          
    is_important BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(cycle_id, master_kpi_id)
);
CREATE INDEX idx_kpis_info_cycle ON kpis_information(cycle_id) WHERE deleted_at IS NULL;


-- ============================================================================
-- MODULE 4: TRANSACTION & WORKFLOW (BẢNG ALL-IN-ONE PARTITION LIST)
-- ============================================================================
CREATE TABLE kpi_assignments (
    id UUID DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL, 
    kpi_info_id UUID REFERENCES kpis_information(id), 
    
    user_id UUID REFERENCES users(id),             
    department_id UUID REFERENCES departments(id), 
    job_title_id UUID REFERENCES job_titles(id), 
    parent_assignment_id UUID,
    
    target_value NUMERIC(10,2),   
    
    -- Buffer lưu data đang xin đổi (Update Request)
    update_payload JSONB, 
    update_reason TEXT,   
    
    -- Điểm số 1st Half (Chỉ có tự đánh giá theo yêu cầu)
    mid_self_score NUMERIC(5,2),
    
    -- Điểm số Final 2nd Half (Đủ 3 cấp đánh giá)
    end_self_score NUMERIC(5,2),
    end_pm_score NUMERIC(5,2),
    end_gm_score NUMERIC(5,2), 
    
    evidences JSONB, 
    
    -- Máy trạng thái All-in-One dùng CODE (Mặc định 401: INACTIVE)
    status_code INTEGER REFERENCES sys_status_codes(code) DEFAULT 401, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE,
    
    PRIMARY KEY (id, cycle_id),
    
    FOREIGN KEY (parent_assignment_id, cycle_id) REFERENCES kpi_assignments(id, cycle_id) ON DELETE SET NULL,
    CHECK (
        (user_id IS NOT NULL AND department_id IS NULL) OR 
        (user_id IS NULL AND department_id IS NOT NULL)
    )
) PARTITION BY LIST (cycle_id);

-- ============================================================================
-- MODULE 4.1: SNAPSHOT LỊCH SỬ THÔNG TIN USER/DEPARTMENT KHI ASSIGN KPI
-- ============================================================================

CREATE TABLE IF NOT EXISTS kpi_assignment_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assignment_id UUID NOT NULL,
    cycle_id UUID NOT NULL,

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,

    user_full_name VARCHAR(200),
    user_email VARCHAR(255),

    department_name VARCHAR(255),
    job_title_name VARCHAR(255),

    supervisor_full_name VARCHAR(200),
    supervisor_email VARCHAR(255),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    CONSTRAINT fk_kpi_assignment_snapshot_assignment
        FOREIGN KEY (assignment_id, cycle_id)
        REFERENCES kpi_assignments(id, cycle_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_kpi_assignment_snapshot_assignment
        UNIQUE (assignment_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_assignment_snapshots_assignment
ON kpi_assignment_snapshots (assignment_id, cycle_id);

CREATE INDEX IF NOT EXISTS idx_kpi_assignment_snapshots_user
ON kpi_assignment_snapshots (user_id);

CREATE INDEX IF NOT EXISTS idx_kpi_assignment_snapshots_department
ON kpi_assignment_snapshots (department_id);

CREATE INDEX IF NOT EXISTS idx_kpi_assignment_snapshots_cycle
ON kpi_assignment_snapshots (cycle_id);

CREATE TABLE IF NOT EXISTS kpi_assignment_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nếu dùng uuid-ossp thì đổi:
    -- DEFAULT uuid_generate_v4(),

    -- FK tới assignment (composite key)
    assignment_id UUID NOT NULL,
    cycle_id UUID NOT NULL,

    -- Nội dung feedback
    feedback_note TEXT NOT NULL,

    -- Role cần xử lý
    target_role_id UUID NOT NULL REFERENCES roles(id),

    -- Người tạo
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Người xử lý
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Trạng thái
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- FK assignment
    CONSTRAINT fk_feedback_assignment
        FOREIGN KEY (assignment_id, cycle_id)
        REFERENCES kpi_assignments(id, cycle_id)
        ON DELETE CASCADE,

    -- 1. resolved_by và resolved_at phải đi cùng nhau
    CONSTRAINT chk_feedback_resolve_fields
        CHECK (
            (resolved_by IS NULL AND resolved_at IS NULL)
            OR
            (resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
        ),

    -- 2. Ràng buộc chặt trạng thái active vs resolved
    CONSTRAINT chk_feedback_active_vs_resolve
        CHECK (
            (is_active = TRUE AND resolved_by IS NULL AND resolved_at IS NULL)
            OR
            (is_active = FALSE AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
        )
);

-- 3. Unique: mỗi assignment chỉ có 1 feedback active
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_one_active_per_assignment
ON kpi_assignment_feedbacks (assignment_id, cycle_id)
WHERE is_active = TRUE AND deleted_at IS NULL;

-- 4. Index query phổ biến
CREATE INDEX IF NOT EXISTS idx_feedback_assignment
ON kpi_assignment_feedbacks (assignment_id, cycle_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_target_active
ON kpi_assignment_feedbacks (target_role_id, is_active)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
ON kpi_assignment_feedbacks (created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- MODULE 5: CHỐT SỔ (SNAPSHOT LƯU TRỮ LỊCH SỬ REPORT)
-- ============================================================================
CREATE TABLE user_kpi_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    cycle_id UUID REFERENCES kpi_cycles(id) NOT NULL,
    
    final_score NUMERIC(5,2),      
    final_rating VARCHAR(10), 
    calculation_snapshot JSONB, 
    evaluation_comments TEXT,      
    evaluation_supervisor_comments TEXT,
    /** Nhận xét nhân viên (tab Promotion) — tách khỏi evaluation_comments. */
    evaluation_comments_promotion TEXT,
    /** Nhận xét PM tổng (tab Promotion) — tách khỏi evaluation_supervisor_comments. */
    evaluation_supervisor_comments_promotion TEXT,
    evaluator_id UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, updated_by UUID, deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX idx_unique_user_cycle_summary ON user_kpi_summaries(user_id, cycle_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- MODULE 6: INDEXES TỐI ƯU PERFORMANCE
-- ============================================================================
CREATE INDEX idx_kpi_assign_user ON kpi_assignments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kpi_assign_dept ON kpi_assignments(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kpi_assign_parent ON kpi_assignments(parent_assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kpi_assign_cycle ON kpi_assignments(cycle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kpi_assign_status ON kpi_assignments(status_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_kpi_assign_evidences ON kpi_assignments USING GIN (evidences);

-- ============================================================================
-- (Xóa bảng calculation_rules cũ)
DROP TABLE IF EXISTS calculation_rules CASCADE;
