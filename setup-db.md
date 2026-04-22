# Hướng dẫn quản lý Database

Tài liệu này mô tả cách khởi tạo, kiểm tra, và quản lý database PostgreSQL cho dự án KPI.

---

## Mục lục

- [Khởi tạo DB với Docker (khuyến nghị)](#1-khởi-tạo-db-với-docker-khuyến-nghị)
- [Quản lý DB qua pgAdmin 4 (trình duyệt)](#2-quản-lý-db-qua-pgadmin-4-trình-duyệt)
- [Quản lý DB qua dòng lệnh (psql)](#3-quản-lý-db-qua-dòng-lệnh-psql)
- [Reset database](#4-reset-database)
- [Tài khoản mặc định](#5-tài-khoản-mặc-định)
- [Cấu hình kết nối Backend](#6-cấu-hình-kết-nối-backend)

---

## 1. Khởi tạo DB với Docker (khuyến nghị)

Khi chạy `docker-compose up`, Docker tự động:
1. Tạo database `kpi_dev`
2. Chạy `V1__create_schema.sql` — tạo toàn bộ bảng và enum types
3. Chạy `V2__seed_data.sql` — seed data mẫu (departments, users, KPI periods, items)

> **Lưu ý:** Init scripts chỉ chạy khi volume `kpi_postgres_data` được tạo **lần đầu tiên**. Nếu volume đã tồn tại, scripts sẽ không chạy lại (data được giữ nguyên).

### Khởi động

```bash
# Từ thư mục gốc kpi/
cp .env.example .env          # chỉ cần làm 1 lần

docker-compose --profile tools up -d
```

### Kiểm tra DB đã sẵn sàng

```bash
# Kiểm tra container healthy
docker-compose --profile tools ps

# Liệt kê các bảng
docker exec kpi-postgres psql -U postgres -d kpi_dev -c "\dt"
```

Kết quả mong đợi:

```
              List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | departments     | table | postgres
 public | kpi_items       | table | postgres
 public | kpi_periods     | table | postgres
 public | kpi_sheet_items | table | postgres
 public | kpi_sheets      | table | postgres
 public | refresh_tokens  | table | postgres
 public | users           | table | postgres
```

---

## 2. Quản lý DB qua pgAdmin 4 (trình duyệt)

pgAdmin 4 là công cụ quản lý PostgreSQL trực quan qua trình duyệt — dùng để xem data, chạy SQL, tạo/sửa bảng, v.v.

### Truy cập

Sau khi đã chạy `docker-compose --profile tools up -d`:

1. Mở trình duyệt: **[http://localhost:5050](http://localhost:5050)**
2. Đăng nhập:
   - **Email:** `admin@kpi.dev`
   - **Password:** `admin123`

### Kết nối vào database

Server **"KPI PostgreSQL"** đã được cấu hình sẵn trong pgAdmin. Để kết nối:

1. Ở panel trái, mở **Servers** → **KPI PostgreSQL**
2. Nếu hỏi password, nhập: `postgres`
3. Mở rộng: **KPI PostgreSQL → Databases → kpi_dev → Schemas → public → Tables**

### Chạy SQL Query

1. Click chuột phải vào **kpi_dev** → **Query Tool**
2. Gõ câu SQL, nhấn **F5** hoặc nút **▶ Execute**

**Ví dụ một số câu query thường dùng:**

```sql
-- Xem danh sách users
SELECT id, email, full_name, role, is_active FROM users;

-- Xem KPI periods
SELECT id, name, year, quarter, is_active FROM kpi_periods ORDER BY year, quarter;

-- Xem KPI items của một period
SELECT ki.section_name, ki.item_name, ki.weight, ki.max_score
FROM kpi_items ki
JOIN kpi_periods kp ON ki.period_id = kp.id
WHERE kp.year = 2026
ORDER BY ki.section_name, ki.sort_order;

-- Xem trạng thái KPI sheets
SELECT u.email, u.role, ks.status, ks.self_total, ks.final_score
FROM kpi_sheets ks
JOIN users u ON ks.user_id = u.id
ORDER BY ks.status;
```

### Cập nhật data qua pgAdmin

```sql
-- Đổi trạng thái active của period
UPDATE kpi_periods SET is_active = true WHERE year = 2026 AND quarter IS NULL;

-- Reset password một user (hash BCrypt của 'Abc@12345')
UPDATE users
SET password_hash = '$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy'
WHERE email = 'gm@kpi.com';
```

---

## 3. Quản lý DB qua dòng lệnh (psql)

Dùng khi không có pgAdmin hoặc cần thao tác nhanh từ terminal.

### Kết nối vào psql

```bash
# Kết nối trực tiếp vào container
docker exec -it kpi-postgres psql -U postgres -d kpi_dev

# Hoặc từ host (nếu đã cài psql trên máy)
psql -h localhost -p 5556 -U postgres -d kpi_dev
```

### Các lệnh psql thường dùng

```sql
\dt              -- liệt kê tất cả bảng
\d users         -- xem cấu trúc bảng users
\d+ kpi_items    -- xem cấu trúc chi tiết với comments

SELECT * FROM users;
SELECT * FROM kpi_periods;
SELECT * FROM kpi_items WHERE period_id = '...';

\q               -- thoát
```

---

## 4. Reset database

> ⚠️ **Cảnh báo:** Thao tác này xóa toàn bộ data và tạo lại từ đầu.

### Reset nhanh qua Docker (khuyến nghị)

```bash
# Dừng containers
docker-compose --profile tools down

# Xóa volume chứa data
docker volume rm kpi_kpi_postgres_data

# Khởi động lại — Docker sẽ tự tạo DB và chạy init scripts
docker-compose --profile tools up -d
```

### Reset thủ công qua psql

```bash
# Chạy trong container
docker exec -it kpi-postgres psql -U postgres -c "
  DROP DATABASE IF EXISTS kpi_dev;
  CREATE DATABASE kpi_dev;
"

docker exec -i kpi-postgres psql -U postgres -d kpi_dev \
  < kpi-be/src/main/resources/db/migration/V1__create_schema.sql

docker exec -i kpi-postgres psql -U postgres -d kpi_dev \
  < kpi-be/src/main/resources/db/seed/V2__seed_data.sql
```

---

## 5. Tài khoản mặc định

Tất cả tài khoản dùng mật khẩu `Abc@12345`.

| Email              | Họ tên          | Vai trò | Phòng ban     |
|--------------------|-----------------|---------|---------------|
| gm@kpi.com         | Nguyễn Văn GM   | GM      | Ban Giám Đốc  |
| pm@kpi.com         | Trần Thị PM     | PM      | Phòng QLDA    |
| leader@kpi.com     | Lê Văn Leader   | LEADER  | Phòng Kỹ Thuật|
| member1@kpi.com    | Phạm Thị Hoa    | MEMBER  | Phòng Kỹ Thuật|
| member2@kpi.com    | Hoàng Minh Tuấn | MEMBER  | Phòng Kỹ Thuật|
| member3@kpi.com    | Ngô Thị Lan     | MEMBER  | Phòng QA/QC   |
| member@kpi.com     | Đặng Quốc Bảo   | MEMBER  | Phòng Kỹ Thuật|

> **BCrypt hash** dùng cho `Abc@12345`:  
> `$2a$10$BjRmmksBiefPBieq4ClE9OTHwn8/VPampKpiJQNOn80Pg2Tt9kcMy`

---

## 6. Cấu hình kết nối Backend

File: `kpi-be/src/main/resources/application-local.properties`

```properties
# Kết nối PostgreSQL (Docker, port 5556)
spring.datasource.url=jdbc:postgresql://localhost:5556/kpi_dev?stringtype=unspecified
spring.datasource.username=postgres
spring.datasource.password=postgres

# Server
server.port=8081
server.servlet.context-path=/api

# JWT
jwt.secret=kpi-super-secret-key-2026-dev-ok
jwt.access-token.expiration=18000000
jwt.refresh-token.expiration=604800000
```

> Profile `local` được bật sẵn trong `application.properties`. Không cần truyền thêm tham số khi chạy `mvn spring-boot:run`.

---

## Thông tin kết nối nhanh

| Thành phần | Host      | Port | User     | Password |
|-----------|-----------|------|----------|----------|
| PostgreSQL | localhost | 5556 | postgres | postgres |
| pgAdmin 4  | localhost | 5050 | admin@kpi.dev | admin123 |
| Redis      | localhost | 6380 | —        | —        |
| Backend    | localhost | 8081 | —        | —        |
| Frontend   | localhost | 5173 | —        | —        |
