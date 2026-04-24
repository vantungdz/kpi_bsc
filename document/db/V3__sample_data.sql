-- ============================================================================
-- V3__sample_data.sql
-- Script tạo dữ liệu mẫu cho hệ thống KPI
--
-- Cấu trúc tổ chức:
--   1 GM (gm@kpi.com, R10)
--   8 Section, mỗi section có:
--     1 PM  (pm{n}@kpi.com, R8)       → quản lý section
--     1 Leader (leader{n}@kpi.com, R6) → báo cáo PM, quản lý 1 member
--     3 Member:
--       - member{3n-2}@kpi.com (R2 Junior)   → báo cáo Leader
--       - member{3n-1}@kpi.com (R3 Mid)      → báo cáo PM
--       - member{3n}@kpi.com   (R4 Senior)   → báo cáo PM
--
-- UUID scheme:
--   Users:       e1000000-0000-0000-0000-000000000001 (GM)
--                e1000000-0000-0000-0000-000000000002 ~ 009 (PM1-8)
--                e1000000-0000-0000-0000-000000000010 ~ 017 (Leader1-8)
--                e1000000-0000-0000-0000-000000000018 ~ 041 (Member1-24)
--   Departments: f1000000-0000-0000-0000-000000000001 (Company)
--                f1000000-0000-0000-0000-000000000002 ~ 009 (Section1-8)
--
-- Password hash: "Abc@12345"
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 0: SYS_STATUS_CODES (Master codes - insert nếu chưa có)
-- ============================================================================
INSERT INTO sys_status_codes (code, category, name, description) VALUES
-- 1xx: KPI TYPE
(101, 'KPI_TYPE', 'INDIVIDUAL', 'Muc tieu ca nhan'),
(102, 'KPI_TYPE', 'TEAM',       'Muc tieu phong ban/nhom'),
(103, 'KPI_TYPE', 'PROMOTION',  'Muc tieu thang tien'),
-- 2xx: CYCLE STATUS
(201, 'CYCLE_STATUS', 'OPEN',   'Chu ky dang mo'),
(202, 'CYCLE_STATUS', 'CLOSED', 'Chu ky da dong'),
-- 4xx: ASM_STATUS Phase 1
(401, 'ASM_STATUS', 'INACTIVE',              'KPI moi tao (Chua kich hoat)'),
(402, 'ASM_STATUS', 'WAITING_PM_APPROVAL',   'Member tao, cho PM duyet'),
(403, 'ASM_STATUS', 'WAITING_GM_APPROVAL',   'Cho GM duyet tao moi'),
(404, 'ASM_STATUS', 'PENDING_ACCEPTANCE',    'Cho Member bam Accept'),
(405, 'ASM_STATUS', 'ACCEPTED',              'Da chot muc tieu (Dang chay)'),
(406, 'ASM_STATUS', 'REJECTED',              'Bi tu choi'),
-- 5xx: ASM_STATUS Phase 2
(501, 'ASM_STATUS', '1ST_WAITING_PM_APPROVAL', 'Member da nop bang chung 1st Half, cho PM duyet'),
(502, 'ASM_STATUS', '1ST_WAITING_GM_APPROVAL', 'PM da duyet 1st Half, cho GM chot diem'),
(503, 'ASM_STATUS', '1ST_COMPLETED',            'GM da chot diem 1st Half'),
-- 6xx: ASM_STATUS Phase 3
(601, 'ASM_STATUS', '2ND_WAITING_PM_APPROVAL', 'Cho PM cham diem Final'),
(602, 'ASM_STATUS', '2ND_WAITING_GM_APPROVAL', 'Cho GM chot diem Final'),
(603, 'ASM_STATUS', 'COMPLETED',               'Da chot so hoan toan (Ket thuc vong doi)'),
-- 7xx: CALC_TYPE
(701, 'CALC_TYPE', 'ACTUAL_OVER_PLAN', 'Actual / Plan'),
(702, 'CALC_TYPE', 'PLAN_OVER_ACTUAL', 'Plan / Actual'),
(703, 'CALC_TYPE', 'MANUAL_RATING',    'Manual Rating'),
-- 8xx: CALC_RULE
(801, 'CALC_RULE', 'SUM',         'Cong don diem cua cac KPI con'),
(802, 'CALC_RULE', 'AVERAGE',     'Lay trung binh cong diem cac KPI con'),
(803, 'CALC_RULE', 'COMMENT',     'Nhap diem thu cong dua tren nhan xet danh gia'),
(804, 'CALC_RULE', 'WEIGHTED_AVG','Trung binh cong co trong so'),
-- 9xx: KPI_UNIT
(901, 'KPI_UNIT', 'MM',          'Man-Month'),
(902, 'KPI_UNIT', 'Percent',     'Phan tram (%)'),
(903, 'KPI_UNIT', 'Point',       'Diem so'),
(904, 'KPI_UNIT', 'Product',     'San pham'),
(905, 'KPI_UNIT', 'Project',     'Du an'),
(906, 'KPI_UNIT', 'Certification','Chung chi'),
(907, 'KPI_UNIT', 'Article',     'Bai viet / Bai bao'),
(908, 'KPI_UNIT', 'Person',      'Nguoi / Nhan su')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 1: ROLES
-- ============================================================================
INSERT INTO roles (id, code, name) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'GM',     'General Manager'),
  ('a1000000-0000-0000-0000-000000000002', 'PM',     'Project Manager'),
  ('a1000000-0000-0000-0000-000000000003', 'LEADER', 'Team Leader'),
  ('a1000000-0000-0000-0000-000000000004', 'MEMBER', 'Team Member')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 2: JOB FAMILIES
-- ============================================================================
INSERT INTO job_families (id, code, name) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'DEV',  'Software Development'),
  ('b1000000-0000-0000-0000-000000000002', 'QA',   'Quality Assurance'),
  ('b1000000-0000-0000-0000-000000000003', 'BA',   'Business Analysis'),
  ('b1000000-0000-0000-0000-000000000004', 'MGMT', 'Management')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 3: RANKS (10 cấp bậc R1 → R10, GM là R10)
-- ============================================================================
INSERT INTO ranks (id, code, name) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'R1',  'Fresher'),
  ('c1000000-0000-0000-0000-000000000002', 'R2',  'Junior'),
  ('c1000000-0000-0000-0000-000000000003', 'R3',  'Mid-Level'),
  ('c1000000-0000-0000-0000-000000000004', 'R4',  'Senior'),
  ('c1000000-0000-0000-0000-000000000005', 'R5',  'Principal'),
  ('c1000000-0000-0000-0000-000000000006', 'R6',  'Technical Lead'),
  ('c1000000-0000-0000-0000-000000000007', 'R7',  'Senior Lead'),
  ('c1000000-0000-0000-0000-000000000008', 'R8',  'Manager'),
  ('c1000000-0000-0000-0000-000000000009', 'R9',  'Senior Manager'),
  ('c1000000-0000-0000-0000-000000000010', 'R10', 'Director / GM')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 4: JOB TITLES (Chức danh = Job Family + Rank)
-- ============================================================================
INSERT INTO job_titles (id, job_family_id, rank_id, name) VALUES
  -- Management
  ('d1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000010',
   'General Manager'),
  ('d1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000008',
   'Project Manager'),
  -- Dev
  ('d1000000-0000-0000-0000-000000000003',
   'b1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000006',
   'Technical Lead'),
  ('d1000000-0000-0000-0000-000000000004',
   'b1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000004',
   'Senior Developer'),
  ('d1000000-0000-0000-0000-000000000005',
   'b1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000003',
   'Mid-Level Developer'),
  ('d1000000-0000-0000-0000-000000000006',
   'b1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',
   'Junior Developer'),
  ('d1000000-0000-0000-0000-000000000007',
   'b1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Fresher Developer'),
  -- QA
  ('d1000000-0000-0000-0000-000000000008',
   'b1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000003',
   'Mid-Level QA Engineer'),
  -- BA
  ('d1000000-0000-0000-0000-000000000009',
   'b1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000003',
   'Mid-Level Business Analyst')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 5: USERS
-- Mật khẩu "Abc@12345" → BCrypt hash:
--   $2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy
-- ============================================================================

-- ── GM ───────────────────────────────────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'gm', 'gm@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran GM',
   'd1000000-0000-0000-0000-000000000001',
   true)
ON CONFLICT DO NOTHING;

-- ── PM 1-8 ───────────────────────────────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000002',
   'pm1', 'pm1@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 1', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000003',
   'pm2', 'pm2@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 2', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000004',
   'pm3', 'pm3@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 3', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000005',
   'pm4', 'pm4@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 4', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000006',
   'pm5', 'pm5@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 5', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000007',
   'pm6', 'pm6@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 6', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000008',
   'pm7', 'pm7@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 7', 'd1000000-0000-0000-0000-000000000002', true),
  ('e1000000-0000-0000-0000-000000000009',
   'pm8', 'pm8@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran PM 8', 'd1000000-0000-0000-0000-000000000002', true)
ON CONFLICT DO NOTHING;

-- ── Leader 1-8 ───────────────────────────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000010',
   'leader1', 'leader1@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 1', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000011',
   'leader2', 'leader2@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 2', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000012',
   'leader3', 'leader3@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 3', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000013',
   'leader4', 'leader4@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 4', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000014',
   'leader5', 'leader5@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 5', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000015',
   'leader6', 'leader6@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 6', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000016',
   'leader7', 'leader7@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 7', 'd1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000017',
   'leader8', 'leader8@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Leader 8', 'd1000000-0000-0000-0000-000000000003', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 1 (member1-3) ───────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000018',
   'member1', 'member1@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 1', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000019',
   'member2', 'member2@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 2', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000020',
   'member3', 'member3@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 3', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 2 (member4-6) ───────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000021',
   'member4', 'member4@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 4', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000022',
   'member5', 'member5@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 5', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000023',
   'member6', 'member6@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 6', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 3 (member7-9) ───────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000024',
   'member7', 'member7@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 7', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000025',
   'member8', 'member8@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 8', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000026',
   'member9', 'member9@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 9', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 4 (member10-12) ─────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000027',
   'member10', 'member10@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 10', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000028',
   'member11', 'member11@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 11', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000029',
   'member12', 'member12@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 12', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 5 (member13-15) ─────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000030',
   'member13', 'member13@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 13', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000031',
   'member14', 'member14@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 14', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000032',
   'member15', 'member15@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 15', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 6 (member16-18) ─────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000033',
   'member16', 'member16@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 16', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000034',
   'member17', 'member17@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 17', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000035',
   'member18', 'member18@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 18', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 7 (member19-21) ─────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000036',
   'member19', 'member19@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 19', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000037',
   'member20', 'member20@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 20', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000038',
   'member21', 'member21@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 21', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Member - Section 8 (member22-24) ─────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, full_name, job_title_id, is_active) VALUES
  ('e1000000-0000-0000-0000-000000000039',
   'member22', 'member22@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 22', 'd1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000040',
   'member23', 'member23@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 23', 'd1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000041',
   'member24', 'member24@kpi.com',
   '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy',
   'Tran Member 24', 'd1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 6: DEPARTMENTS
-- ============================================================================
INSERT INTO departments (id, name, parent_id, manager_id) VALUES
  -- Công ty (root) - do GM quản lý
  ('f1000000-0000-0000-0000-000000000001',
   'Công ty',
   NULL,
   'e1000000-0000-0000-0000-000000000001'),
  -- 8 Section - mỗi section do 1 PM quản lý
  ('f1000000-0000-0000-0000-000000000002',
   'Section 1',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000002'),  -- PM1
  ('f1000000-0000-0000-0000-000000000003',
   'Section 2',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000003'),  -- PM2
  ('f1000000-0000-0000-0000-000000000004',
   'Section 3',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000004'),  -- PM3
  ('f1000000-0000-0000-0000-000000000005',
   'Section 4',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000005'),  -- PM4
  ('f1000000-0000-0000-0000-000000000006',
   'Section 5',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000006'),  -- PM5
  ('f1000000-0000-0000-0000-000000000007',
   'Section 6',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000007'),  -- PM6
  ('f1000000-0000-0000-0000-000000000008',
   'Section 7',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000008'),  -- PM7
  ('f1000000-0000-0000-0000-000000000009',
   'Section 8',
   'f1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000009')   -- PM8
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 7: USER_DEPARTMENTS
-- supervisor_id = người trực tiếp quản lý (PM báo cáo GM, Leader báo cáo PM,
--   Member{3n-2} báo cáo Leader, Member{3n-1} & {3n} báo cáo PM)
-- ============================================================================

-- GM thuộc Công ty
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000001', NULL, true)
ON CONFLICT DO NOTHING;

-- ── Section 1 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  -- PM1 → báo cáo GM
  ('e1000000-0000-0000-0000-000000000002',
   'f1000000-0000-0000-0000-000000000002',
   'e1000000-0000-0000-0000-000000000001', true),
  -- Leader1 → báo cáo PM1
  ('e1000000-0000-0000-0000-000000000010',
   'f1000000-0000-0000-0000-000000000002',
   'e1000000-0000-0000-0000-000000000002', true),
  -- member1 (Junior) → báo cáo Leader1
  ('e1000000-0000-0000-0000-000000000018',
   'f1000000-0000-0000-0000-000000000002',
   'e1000000-0000-0000-0000-000000000010', true),
  -- member2 (Mid) → báo cáo PM1
  ('e1000000-0000-0000-0000-000000000019',
   'f1000000-0000-0000-0000-000000000002',
   'e1000000-0000-0000-0000-000000000002', true),
  -- member3 (Senior) → báo cáo PM1
  ('e1000000-0000-0000-0000-000000000020',
   'f1000000-0000-0000-0000-000000000002',
   'e1000000-0000-0000-0000-000000000002', true)
ON CONFLICT DO NOTHING;

-- ── Section 2 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000003',
   'f1000000-0000-0000-0000-000000000003',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000011',
   'f1000000-0000-0000-0000-000000000003',
   'e1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000021',
   'f1000000-0000-0000-0000-000000000003',
   'e1000000-0000-0000-0000-000000000011', true),
  ('e1000000-0000-0000-0000-000000000022',
   'f1000000-0000-0000-0000-000000000003',
   'e1000000-0000-0000-0000-000000000003', true),
  ('e1000000-0000-0000-0000-000000000023',
   'f1000000-0000-0000-0000-000000000003',
   'e1000000-0000-0000-0000-000000000003', true)
ON CONFLICT DO NOTHING;

-- ── Section 3 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000004',
   'f1000000-0000-0000-0000-000000000004',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000012',
   'f1000000-0000-0000-0000-000000000004',
   'e1000000-0000-0000-0000-000000000004', true),
  ('e1000000-0000-0000-0000-000000000024',
   'f1000000-0000-0000-0000-000000000004',
   'e1000000-0000-0000-0000-000000000012', true),
  ('e1000000-0000-0000-0000-000000000025',
   'f1000000-0000-0000-0000-000000000004',
   'e1000000-0000-0000-0000-000000000004', true),
  ('e1000000-0000-0000-0000-000000000026',
   'f1000000-0000-0000-0000-000000000004',
   'e1000000-0000-0000-0000-000000000004', true)
ON CONFLICT DO NOTHING;

-- ── Section 4 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000005',
   'f1000000-0000-0000-0000-000000000005',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000013',
   'f1000000-0000-0000-0000-000000000005',
   'e1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000027',
   'f1000000-0000-0000-0000-000000000005',
   'e1000000-0000-0000-0000-000000000013', true),
  ('e1000000-0000-0000-0000-000000000028',
   'f1000000-0000-0000-0000-000000000005',
   'e1000000-0000-0000-0000-000000000005', true),
  ('e1000000-0000-0000-0000-000000000029',
   'f1000000-0000-0000-0000-000000000005',
   'e1000000-0000-0000-0000-000000000005', true)
ON CONFLICT DO NOTHING;

-- ── Section 5 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000006',
   'f1000000-0000-0000-0000-000000000006',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000014',
   'f1000000-0000-0000-0000-000000000006',
   'e1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000030',
   'f1000000-0000-0000-0000-000000000006',
   'e1000000-0000-0000-0000-000000000014', true),
  ('e1000000-0000-0000-0000-000000000031',
   'f1000000-0000-0000-0000-000000000006',
   'e1000000-0000-0000-0000-000000000006', true),
  ('e1000000-0000-0000-0000-000000000032',
   'f1000000-0000-0000-0000-000000000006',
   'e1000000-0000-0000-0000-000000000006', true)
ON CONFLICT DO NOTHING;

-- ── Section 6 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000007',
   'f1000000-0000-0000-0000-000000000007',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000015',
   'f1000000-0000-0000-0000-000000000007',
   'e1000000-0000-0000-0000-000000000007', true),
  ('e1000000-0000-0000-0000-000000000033',
   'f1000000-0000-0000-0000-000000000007',
   'e1000000-0000-0000-0000-000000000015', true),
  ('e1000000-0000-0000-0000-000000000034',
   'f1000000-0000-0000-0000-000000000007',
   'e1000000-0000-0000-0000-000000000007', true),
  ('e1000000-0000-0000-0000-000000000035',
   'f1000000-0000-0000-0000-000000000007',
   'e1000000-0000-0000-0000-000000000007', true)
ON CONFLICT DO NOTHING;

-- ── Section 7 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000008',
   'f1000000-0000-0000-0000-000000000008',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000016',
   'f1000000-0000-0000-0000-000000000008',
   'e1000000-0000-0000-0000-000000000008', true),
  ('e1000000-0000-0000-0000-000000000036',
   'f1000000-0000-0000-0000-000000000008',
   'e1000000-0000-0000-0000-000000000016', true),
  ('e1000000-0000-0000-0000-000000000037',
   'f1000000-0000-0000-0000-000000000008',
   'e1000000-0000-0000-0000-000000000008', true),
  ('e1000000-0000-0000-0000-000000000038',
   'f1000000-0000-0000-0000-000000000008',
   'e1000000-0000-0000-0000-000000000008', true)
ON CONFLICT DO NOTHING;

-- ── Section 8 ────────────────────────────────────────────────────────────────
INSERT INTO user_departments (user_id, department_id, supervisor_id, is_primary) VALUES
  ('e1000000-0000-0000-0000-000000000009',
   'f1000000-0000-0000-0000-000000000009',
   'e1000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000017',
   'f1000000-0000-0000-0000-000000000009',
   'e1000000-0000-0000-0000-000000000009', true),
  ('e1000000-0000-0000-0000-000000000039',
   'f1000000-0000-0000-0000-000000000009',
   'e1000000-0000-0000-0000-000000000017', true),
  ('e1000000-0000-0000-0000-000000000040',
   'f1000000-0000-0000-0000-000000000009',
   'e1000000-0000-0000-0000-000000000009', true),
  ('e1000000-0000-0000-0000-000000000041',
   'f1000000-0000-0000-0000-000000000009',
   'e1000000-0000-0000-0000-000000000009', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 8: USER_ROLES
-- ============================================================================

-- GM
INSERT INTO user_roles (user_id, role_id) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- PM 1-8
INSERT INTO user_roles (user_id, role_id) VALUES
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002'),
  ('e1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Leader 1-8
INSERT INTO user_roles (user_id, role_id) VALUES
  ('e1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000003'),
  ('e1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Member 1-24
INSERT INTO user_roles (user_id, role_id) VALUES
  ('e1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000025', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000026', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000027', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000028', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000029', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000031', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000032', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000033', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000034', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000035', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000036', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000037', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000038', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000039', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000040', 'a1000000-0000-0000-0000-000000000004'),
  ('e1000000-0000-0000-0000-000000000041', 'a1000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 9: KPI CATEGORIES
-- ============================================================================
INSERT INTO kpi_categories (id, name) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'A - Hiệu quả công việc chuyên môn'),
  ('a2000000-0000-0000-0000-000000000002', 'B - Phát triển bản thân & đóng góp'),
  ('a2000000-0000-0000-0000-000000000003', 'C - Năng lực quản lý'),
  ('a2000000-0000-0000-0000-000000000004', 'P - KPI thăng tiến')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 10: KPI CYCLES
-- ============================================================================
INSERT INTO kpi_cycles (id, year, name,
    goal_setting_start, goal_setting_end,
    mid_year_start, mid_year_end,
    end_year_start, end_year_end,
  status_code) VALUES
  ('c2000000-0000-0000-0000-000000000001',
   2026,
   'Năm 2026',
   '2026-02-01 23:59:59+07',
   '2026-02-28 23:59:59+07',
   '2026-07-01 23:59:59+07',
   '2026-07-15 23:59:59+07',
   '2026-12-01 23:59:59+07',
   '2026-12-20 23:59:59+07',
   201)   -- OPEN
ON CONFLICT DO NOTHING;

INSERT INTO kpi_cycles (id, year, name,
    goal_setting_start, goal_setting_end,
    mid_year_start, mid_year_end,
    end_year_start, end_year_end,
  status_code) VALUES
  ('c2000000-0000-0000-0000-000000000002',
   2025,
   'Năm 2025',
   '2025-02-01 23:59:59+07',
   '2025-02-28 23:59:59+07',
   '2025-07-01 23:59:59+07',
   '2025-07-15 23:59:59+07',
   '2025-12-01 23:59:59+07',
   '2025-12-20 23:59:59+07',
   202)   -- CLOSED
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 11: KPI MASTER, TEMPLATES, KPIS_INFORMATION
-- Không tạo dữ liệu KPI - sẽ được tạo qua giao diện
-- ============================================================================

-- ============================================================================
-- SECTION 12: TẠO PARTITION CHO KPI_ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS kpi_assignments_2026
  PARTITION OF kpi_assignments
  FOR VALUES IN ('c2000000-0000-0000-0000-000000000001');

CREATE TABLE IF NOT EXISTS kpi_assignments_2025
  PARTITION OF kpi_assignments
  FOR VALUES IN ('c2000000-0000-0000-0000-000000000002');

-- ============================================================================
-- Không tạo KPI Assignments (kpi_assignments)
-- Toàn bộ dữ liệu KPI sẽ được nhập qua giao diện
-- ============================================================================