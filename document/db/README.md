# TÀI LIỆU REVIEW: KIẾN TRÚC DATABASE HỆ THỐNG QUẢN LÝ KPI (V3.0)

**Mục tiêu:** Xây dựng hệ thống lõi chuẩn 3NF, linh hoạt cấu trúc cây mục tiêu (KPI Tree), tối ưu truy vấn với Table Partitioning và sẵn sàng cho việc phân tích báo cáo dữ liệu xuyên năm (Cross-year Reporting). Phiên bản này áp dụng **Máy trạng thái tập trung (Centralized State Machine)** và **chuẩn hóa Data Codes** bằng số nguyên để tối ưu cho hệ thống Backend.

-----

## PHẦN 1: TỔNG QUAN CHỨC NĂNG THEO TỪNG CỤM TABLE

Hệ thống được chia thành 6 cụm logic chính. Dữ liệu sẽ chảy tuần tự từ Cấu hình $\rightarrow$ Định nghĩa thư viện $\rightarrow$ Vận hành và chốt ở Lưu trữ lịch sử.

<br>

### CỤM 0: SYSTEM MASTER CODES (TỪ ĐIỂN DỮ LIỆU)

> *Giải quyết bài toán: Dọn dẹp các chuỗi hard-code rải rác, tập trung toàn bộ Enum/Status của hệ thống về một nguồn duy nhất.*

  * **`sys_status_codes`**: Bảng từ điển định dạng bằng mã số Integer (Hệ thống 100). Chứa các mã như `1xx` (Loại KPI), `2xx` (Chu kỳ), `4xx` (Tạo & Xin đổi), `5xx` (Đánh giá 1st Half) và `6xx` (Đánh giá 2nd Half). Backend và UI dùng bảng này để map Enum và hiển thị Dropdown.

<br>

### CỤM 1 & 2: CƠ CẤU TỔ CHỨC & PHÂN QUYỀN (ORG & USERS)

> *Giải quyết bài toán: Sơ đồ tổ chức đa cấp, phân quyền Hybrid.*

  * **`job_families`, `ranks`, `job_titles`**: Cấu trúc tạo nên Chức danh của nhân viên (VD: DEV + R1 = Junior Dev). Dùng để giao KPI hàng loạt.
  * **`users`**, **`refresh_tokens`**: Bảng thông tin nhân viên và bảo mật.
  * **`departments`**, **`user_departments`**: Lưu cây phòng ban và xác định PM có quyền duyệt KPI.
  * **`roles`, `user_roles`**: Phân quyền RBAC (GM, PM, Member...).

<br>

### CỤM 3: MASTER DATA, TEMPLATE & CHU KỲ (THƯ VIỆN GỐC)

> *Giải quyết bài toán: Tracking lịch sử 1 KPI qua nhiều năm và tái sử dụng bộ tiêu chuẩn.*

  * **`kpi_cycles`**: Quản lý năm tài chính và các mốc deadline.
  * **`calculation_rules`**: Bảng từ điển công thức (SUM, AVG) dùng để Backend rẽ nhánh logic.
  * **`kpi_master`**: Thư viện vĩnh cửu. Có cột **`is_global`** để phân biệt KPI do Công ty giao xuống (TRUE) hay KPI do Member tự đề xuất (FALSE). Phục vụ xuất Report lịch sử.
  * **`kpi_templates`**, **`kpi_template_items`**: Đóng gói KPI thành các bộ mẫu có sẵn Target/Weight.
  * **`kpis_information`**: Giao lộ kết nối `kpi_master` với từng năm (`cycle_id`). Xác định Target chuẩn và Weight chuẩn của riêng năm đó.

<br>

### CỤM 4: TRANSACTION & WORKFLOW (BẢNG VẬN HÀNH ALL-IN-ONE)

> *Trái tim của hệ thống. Gộp cả luồng Giao việc, Xin cập nhật và Đánh giá vào 1 bảng duy nhất.*

  * **`kpi_assignments`**: Bảng lõi Partition theo `cycle_id`.
      * **Giao việc & Cây KPI:** Trỏ về `kpi_info_id` để lấy data gốc, lưu `target_value` thực tế của từng cá nhân. Có đệ quy `parent_assignment_id` để phân bổ từ Sếp xuống Lính.
      * **Gộp Luồng Xin Đổi (Requests):** Chứa cột `update_payload` (JSONB) và `update_reason`. Các thay đổi xin duyệt sẽ nằm chờ ở đây, duyệt xong mới đè lên dữ liệu thật.
      * **Chấm điểm 3 cấp:** Lưu trữ đầy đủ cả điểm tự chấm (`self_score`), điểm PM chấm (`pm_score`) và điểm GM chốt (`gm_score`) cho cả 2 kỳ (Mid và End).
      * **Máy Trạng Thái:** Cột `status_code` sẽ quản lý toàn bộ vòng đời KPI từ khi tạo nháp, phê duyệt tạo mới, xin cập nhật, đến khi chốt sổ cuối năm.

<br>

### CỤM 5: CHỐT SỔ (SNAPSHOT)

> *Giải quyết bài toán: Bảo vệ dữ liệu lịch sử.*

  * **`user_kpi_summaries`**: Ghi nhận Final Score và Rating. Chứa **`calculation_snapshot` (JSONB)** để đóng băng cấu trúc tính điểm của năm đó, chống việc Sếp sửa cấu trúc làm sai lệch lịch sử.

-----

## PHẦN 2: DATA FLOW (CÁCH DỮ LIỆU CHẢY)

### Flow 1: Setup Đầu Năm & Tái sử dụng bằng Template

1.  GM tạo chu kỳ "Năm 2026" ở bảng `kpi_cycles`.
2.  GM lấy bộ "Template Dev R1" từ `kpi_templates`, hệ thống tự động bốc các `kpi_master` tương ứng, map vào bảng `kpis_information` cho năm 2026 với Target/Weight mặc định.

### Flow 2: Giao việc từ trên xuống (Top-Down Assign)

1.  Dựa vào `kpis_information`, GM giao việc cho Khối $\rightarrow$ Insert vào `kpi_assignments` (Tầng 1).
2.  PM chia nhỏ KPI của Khối cho Lính $\rightarrow$ Insert `kpi_assignments` với `parent_assignment_id` = Tầng 1.
3.  `status_code` chạy từ 404 (Chờ Accept) thành 405 (Đã Accept / Đang chạy).

### Flow 3: Đề xuất KPI từ dưới lên (Bottom-Up Stealth Mode)

1.  Member tự tạo KPI (VD: Học tiếng Nhật).
2.  Backend tự động Insert vào `kpi_master` với cờ `is_global = FALSE` (Để không rác thư viện của GM), map vào `kpis_information`, và tạo record trong `kpi_assignments`.
3.  `status_code` được set thành 402 (Chờ PM duyệt). Đi qua PM duyệt $\rightarrow$ GM duyệt (403) thì mới thành 405 (Đang chạy).

### Flow 4: Xin Cập Nhật Target / Weight giữa kỳ (Update Workflow)

1.  Member xin đổi Target: Hệ thống lưu số mới vào `update_payload (JSONB)` và đổi `status_code` thành 411 (Chờ PM duyệt).
2.  PM và GM lần lượt duyệt qua các mã 411 $\rightarrow$ 412.
3.  Khi duyệt xong, Backend móc data từ JSONB ghi đè lên cột thật, trả `status_code` về lại bình thường và clear payload.

### Flow 5: Đánh giá & Chốt sổ 3 lớp (1st Half / 2nd Half)

1.  **Mở đợt:** Đổi `status_code` hàng loạt sang 501 (Kỳ 1) hoặc 601 (Kỳ cuối).
2.  **Member (Self):** Nộp bằng chứng, nhập điểm tự chấm (`mid/end_self_score`) $\rightarrow$ Mã 502/602.
3.  **Quản lý (PM):** Chấm điểm (`pm_score`), đẩy lên Sếp $\rightarrow$ Mã 503/603.
4.  **Giám đốc (GM):** Điều chỉnh và chốt điểm Final (`gm_score`) $\rightarrow$ Kết thúc kỳ bằng Mã 504 hoặc đóng sổ vĩnh viễn với Mã 604 (COMPLETED).

-----
# 🧩 1. SYSTEM MASTER (Dictionary / Enum)

### `sys_status_codes`

| Column      | Type         | Description                                |
| ----------- | ------------ | ------------------------------------------ |
| code        | INTEGER (PK) | Mã định danh (vd: 101, 401…)               |
| category    | VARCHAR(50)  | Nhóm (KPI_TYPE, CYCLE_STATUS, ASM_STATUS…) |
| name        | VARCHAR(100) | Tên enum (map BE/FE)                       |
| description | TEXT         | Mô tả                                      |

👉 **Purpose**

* Centralized enum → tránh hard-code
* Dùng cho toàn bộ system (type, status, workflow) 

---

# 🏢 2. ORGANIZATION & USERS

## 2.1 Job Structure

### `job_families`

| Column | Type         | Description    |
| ------ | ------------ | -------------- |
| id     | UUID (PK)    | ID             |
| code   | VARCHAR(50)  | Code nhóm nghề |
| name   | VARCHAR(100) | Tên nhóm       |

### `ranks`

| Column | Type         | Description     |
| ------ | ------------ | --------------- |
| id     | UUID (PK)    | ID              |
| code   | VARCHAR(50)  | Level (R1, R2…) |
| name   | VARCHAR(100) | Tên level       |

### `job_titles`

| Column        | Type         | Description   |
| ------------- | ------------ | ------------- |
| id            | UUID (PK)    | ID            |
| job_family_id | UUID (FK)    | Nhóm nghề     |
| rank_id       | UUID (FK)    | Level         |
| name          | VARCHAR(255) | Tên chức danh |

👉 **Purpose**
→ Combine: *Family + Rank = Job Title*
→ Dùng để assign KPI hàng loạt

---

## 2.2 Users & Auth

### `users`

| Column        | Type         | Description |
| ------------- | ------------ | ----------- |
| id            | UUID (PK)    | User ID     |
| username      | VARCHAR(100) | Username    |
| email         | VARCHAR(255) | Email       |
| password_hash | VARCHAR(255) | Password    |
| full_name     | VARCHAR(200) | Tên         |
| job_title_id  | UUID (FK)    | Chức danh   |
| is_active     | BOOLEAN      | Trạng thái  |

### `refresh_tokens`

| Column     | Type      | Description   |
| ---------- | --------- | ------------- |
| id         | UUID (PK) | Token ID      |
| user_id    | UUID (FK) | User          |
| token      | TEXT      | Refresh token |
| expires_at | TIMESTAMP | Hết hạn       |
| revoked    | BOOLEAN   | Đã revoke     |

---

## 2.3 Organization Tree

### `departments`

| Column     | Type         | Description   |
| ---------- | ------------ | ------------- |
| id         | UUID (PK)    | ID            |
| name       | VARCHAR(255) | Tên phòng ban |
| parent_id  | UUID (FK)    | Cây phòng ban |
| manager_id | UUID (FK)    | Manager       |

### `user_departments`

| Column        | Type          | Description             |
| ------------- | ------------- | ----------------------- |
| user_id       | UUID (PK, FK) | User                    |
| department_id | UUID (PK, FK) | Department              |
| supervisor_id | UUID          | Người quản lý trực tiếp |
| is_primary    | BOOLEAN       | Phòng chính             |

---

## 2.4 Roles (RBAC)

### `roles`

| Column | Type         | Description |
| ------ | ------------ | ----------- |
| id     | UUID (PK)    | Role ID     |
| code   | VARCHAR(50)  | Code        |
| name   | VARCHAR(100) | Tên         |

### `user_roles`

| Column  | Type          | Description |
| ------- | ------------- | ----------- |
| user_id | UUID (PK, FK) | User        |
| role_id | UUID (PK, FK) | Role        |

---

# 📚 3. KPI MASTER DATA

## 3.1 Cycle & Category

### `kpi_cycles`

| Column                | Type         | Description      |
| --------------------- | ------------ | ---------------- |
| id                    | UUID (PK)    | Cycle ID         |
| year                  | INTEGER      | Năm              |
| name                  | VARCHAR(100) | Tên              |
| goal_setting_deadline | TIMESTAMP    | Deadline set KPI |
| mid_year_deadline     | TIMESTAMP    | Deadline mid     |
| end_year_deadline     | TIMESTAMP    | Deadline final   |
| status_code           | INTEGER (FK) | Trạng thái       |

---

### `kpi_categories`

| Column | Type         | Description   |
| ------ | ------------ | ------------- |
| id     | UUID (PK)    | ID            |
| name   | VARCHAR(255) | Category name |

---

## 3.2 Rules & Master KPI

### `calculation_rules`

| Column      | Type         | Description |
| ----------- | ------------ | ----------- |
| id          | UUID (PK)    | ID          |
| code        | VARCHAR(50)  | Rule code   |
| name        | VARCHAR(100) | Tên         |
| description | TEXT         | Mô tả       |
| is_active   | BOOLEAN      | Active      |

---

### `kpi_master`

| Column              | Type         | Description        |
| ------------------- | ------------ | ------------------ |
| id                  | UUID (PK)    | ID                 |
| code                | VARCHAR(50)  | Code               |
| name                | VARCHAR(255) | KPI name           |
| category_id         | UUID (FK)    | Category           |
| calculation_rule_id | UUID (FK)    | Rule               |
| type_code           | INTEGER (FK) | KPI type           |
| objective           | TEXT         | Mục tiêu           |
| is_global           | BOOLEAN      | KPI global / local |

👉 **Purpose**
→ KPI library xuyên năm 

---

## 3.3 Template

### `kpi_templates`

| Column        | Type         | Description |
| ------------- | ------------ | ----------- |
| id            | UUID (PK)    | Template ID |
| name          | VARCHAR(255) | Tên         |
| description   | TEXT         | Mô tả       |
| job_family_id | UUID         | Áp dụng     |
| rank_id       | UUID         | Áp dụng     |

---

### `kpi_template_items`

| Column               | Type      | Description |
| -------------------- | --------- | ----------- |
| id                   | UUID (PK) | ID          |
| template_id          | UUID (FK) | Template    |
| master_kpi_id        | UUID (FK) | KPI         |
| default_target_value | NUMERIC   | Target      |
| default_weight       | NUMERIC   | Weight      |

---

## 3.4 KPI per Year

### `kpis_information`

| Column             | Type      | Description |
| ------------------ | --------- | ----------- |
| id                 | UUID (PK) | ID          |
| cycle_id           | UUID (FK) | Năm         |
| master_kpi_id      | UUID (FK) | KPI         |
| target_description | TEXT      | Mô tả       |
| target_value       | NUMERIC   | Target      |
| weight             | NUMERIC   | Weight      |
| is_system_created  | BOOLEAN   | System tạo  |

👉 **Purpose**
→ Bridge giữa KPI master và từng năm

---

# ⚙️ 4. KPI TRANSACTION (CORE TABLE)

### `kpi_assignments`

| Column               | Type                | Description     |
| -------------------- | ------------------- | --------------- |
| id                   | UUID (PK composite) | ID              |
| cycle_id             | UUID (PK)           | Partition key   |
| kpi_info_id          | UUID (FK)           | KPI source      |
| user_id              | UUID                | Assign cho user |
| department_id        | UUID                | Assign cho dept |
| job_title_id         | UUID                | Theo role       |
| parent_assignment_id | UUID                | Tree KPI        |
| target_value         | NUMERIC             | Target thực tế  |
| update_payload       | JSONB               | Data xin update |
| update_reason        | TEXT                | Lý do           |
| mid_self_score       | NUMERIC             | Self mid        |
| end_self_score       | NUMERIC             | Self final      |
| end_pm_score         | NUMERIC             | PM              |
| end_gm_score         | NUMERIC             | GM              |
| evidences            | JSONB               | Evidence        |
| status_code          | INTEGER (FK)        | Workflow state  |

👉 **Purpose (VERY IMPORTANT)**

* All-in-one table (assign + update + evaluate) 
* Support:

  * KPI Tree (parent_id)
  * Workflow state machine
  * Multi-level scoring

---

# 📊 5. KPI SNAPSHOT (FINAL RESULT)

### `user_kpi_summaries`

| Column                         | Type        | Description     |
| ------------------------------ | ----------- | --------------- |
| id                             | UUID (PK)   | ID              |
| user_id                        | UUID (FK)   | User            |
| cycle_id                       | UUID (FK)   | Year            |
| final_score                    | NUMERIC     | Điểm cuối       |
| final_rating                   | VARCHAR(10) | Rank            |
| calculation_snapshot           | JSONB       | Snapshot logic  |
| evaluation_comments            | TEXT        | Comment         |
| evaluation_supervisor_comments | TEXT        | Manager comment |
| evaluator_id                   | UUID        | Người chấm      |

👉 **Purpose**
→ Freeze dữ liệu để không bị ảnh hưởng khi thay đổi rule sau này 

---

# 🔄 OVERALL DATA FLOW

```
sys_status_codes
        ↓
kpi_master → kpis_information → kpi_assignments → user_kpi_summaries
                        ↑
                kpi_templates
```