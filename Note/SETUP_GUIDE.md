# Hướng Dẫn Cài Đặt Hệ Thống KPI

> **Yêu cầu:** Docker Desktop, Java 21, Maven 3.9+, Node.js 18+  
> **Terminal:** Mở terminal trong VS Code / Cursor bằng `` Ctrl + ` ``

---

## Tổng quan kiến trúc

```
kpi-fe  (Vue 3 + Vite)   :5173  ──proxy /api──►  kpi-be  (Spring Boot)  :8081
                                                        │
                                               PostgreSQL  :5556  (Docker)
                                               pgAdmin     :5050  (Docker)
```

---

## BƯỚC 1 — Khởi động PostgreSQL và pgAdmin bằng Docker

Mở terminal trong VS Code / Cursor, chạy **2 lệnh** sau:

### 1.1 — Tạo PostgreSQL container

```powershell
docker run -d --name kpi-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kpi_dev -p 5556:5432 postgres:16
```

### 1.2 — Tạo pgAdmin container (giao diện web quản lý DB)

```powershell
docker run -d --name kpi-pgadmin -e PGADMIN_DEFAULT_EMAIL=admin@admin.com -e PGADMIN_DEFAULT_PASSWORD=admin -p 5050:80 dpage/pgadmin4
```

### 1.3 — Kiểm tra container đang chạy

```powershell
docker ps
```

Kết quả mong đợi:
```
NAMES          PORTS                    STATUS
kpi-pgadmin    0.0.0.0:5050->80/tcp     Up
kpi-postgres   0.0.0.0:5556->5432/tcp   Up
```

> **Lần sau** (containers đã tồn tại, chỉ cần start lại):
> ```powershell
> docker start kpi-postgres kpi-pgadmin
> ```

---

## BƯỚC 2 — Tạo Schema và Data bằng pgAdmin (trên trình duyệt)

### 2.1 — Đăng nhập pgAdmin

1. Mở trình duyệt: **http://localhost:5050**
2. Đăng nhập:
   - Email: `admin@admin.com`
   - Password: `admin`

### 2.2 — Kết nối tới PostgreSQL

1. Click **Add New Server**
2. Tab **General** → Name: `kpi-local`
3. Tab **Connection** điền như sau:

   | Field | Giá trị |
   |-------|---------|
   | Host name/address | `host.docker.internal` |
   | Port | `5556` |
   | Maintenance database | `kpi_dev` |
   | Username | `postgres` |
   | Password | `postgres` |

4. Click **Save**

### 2.3 — Mở Query Tool

1. Trong cây bên trái: **kpi-local → Databases → kpi_dev**
2. Click phải vào `kpi_dev` → chọn **Query Tool**

### 2.4 — Chạy Script 1: Tạo Schema

Trong Query Tool:
1. Click biểu tượng **Open File** (📂) hoặc nhấn `Ctrl+O`
2. Chọn file: `d:\Projects\KPI-L\document\db\init-db.sql`
3. Nhấn **F5** để chạy

> ✅ Kết quả: Tạo đầy đủ các bảng (users, roles, kpi_cycles, kpi_master, kpi_assignments...)

### 2.5 — Chạy Script 2: Tạo dữ liệu mẫu

Tương tự bước 2.4, mở file:
`d:\Projects\KPI-L\document\db\V3__sample_data.sql`

> ✅ Kết quả: Tạo users, departments, KPI cycles 2025/2026 và assignments

### 2.6 — Xác nhận dữ liệu

Chạy query kiểm tra trong Query Tool:

```sql
SELECT u.full_name, u.email, r.code AS role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
ORDER BY r.code, u.full_name;
```

Kết quả mong đợi (10 users):
```
full_name          | email                      | role
-------------------+----------------------------+--------
Nguyễn Văn Thắng   | nguyen.gm@company.vn       | GM
Trần Quang Minh    | tran.pm@company.vn         | PM
Nguyễn Thị Lan     | nguyen.leader2@company.vn  | LEADER
Trần Đăng Huy      | tran.leader@company.vn     | LEADER
Đặng Thị Hoa       | hoa.dang@company.vn        | MEMBER
Lê Thị Mai         | mai.le@company.vn          | MEMBER
Nguyễn Quang Huy   | huy.nguyen@company.vn      | MEMBER
Phạm Đức Anh       | anh.pham@company.vn        | MEMBER
Trần Văn Phước     | phuoc.tran@company.vn      | MEMBER
Vũ Minh Tuấn       | tuan.vu@company.vn         | MEMBER
```

---

## BƯỚC 3 — Chạy Backend (kpi-be)

### 3.1 — Kiểm tra application-local.properties

Đảm bảo file `kpi-be\src\main\resources\application-local.properties` có nội dung:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5556/kpi_dev?stringtype=unspecified
spring.datasource.username=postgres
spring.datasource.password=postgres
server.port=8081
server.servlet.context-path=/api
```

### 3.2 — Chạy Backend

Mở **terminal mới** trong VS Code/Cursor (`Ctrl + Shift + ` `), chạy:

```powershell
cd d:\Projects\KPI-L\kpi-be
mvn "spring-boot:run" "-Dspring-boot.run.profiles=local"
```

> **Lý do dùng dấu ngoặc kép:** PowerShell cần quote `spring-boot:run` vì có dấu `:`, và `-Dspring-boot.run.profiles=local` vì có dấu `-D`.

### 3.3 — Kiểm tra Backend đã khởi động

Chờ log xuất hiện trong terminal:
```
Started KpiApplication in X.XXX seconds
Tomcat started on port 8081 with context path '/api'
```

Test login nhanh (mở terminal mới):

```powershell
Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"huy.nguyen@company.vn","password":"Abc@12345"}'
```

Kết quả mong đợi:
```
success : True
data    : @{accessToken=eyJ...; user=@{role=MEMBER; email=huy.nguyen@company.vn}}
```

---

## BƯỚC 4 — Chạy Frontend (kpi-fe)

### 4.1 — Cài dependencies (chỉ lần đầu)

```powershell
cd d:\Projects\KPI-L\kpi-fe
npm install
```

### 4.2 — Kiểm tra file .env

Đảm bảo file `kpi-fe\.env` có nội dung:

```env
VITE_API_BASE_URL=/api/v1
VITE_USE_MOCK=false
```

> `VITE_USE_MOCK=false` → gọi backend thật qua PostgreSQL  
> `VITE_USE_MOCK=true` → dùng mock data (không cần backend)

### 4.3 — Chạy Frontend

Mở **terminal mới** trong VS Code/Cursor, chạy:

```powershell
cd d:\Projects\KPI-L\kpi-fe
npm run dev
```

Mở trình duyệt: **http://localhost:5173**

### 4.4 — (Tùy chọn) Chạy với mock data

```powershell
cd d:\Projects\KPI-L\kpi-fe
npm run dev-mock
```

---

## Tài khoản đăng nhập mặc định

> **Password chung cho tất cả:** `Abc@12345`

| Email | Role | Mô tả |
|-------|------|-------|
| `nguyen.gm@company.vn` | GM | General Manager |
| `tran.pm@company.vn` | PM | Project Manager |
| `tran.leader@company.vn` | LEADER | Team Leader |
| `huy.nguyen@company.vn` | MEMBER | Junior Dev (đang giữa kỳ) |
| `phuoc.tran@company.vn` | MEMBER | Mid Dev (đã PM duyệt) |
| `anh.pham@company.vn` | MEMBER | BA (hoàn chỉnh nhất) |
| `mai.le@company.vn` | MEMBER | QA (còn thiếu bằng chứng) |

---

## Xử lý sự cố thường gặp

### ❌ Lỗi: `Port 8081 was already in use`

```powershell
# Tìm và kill process đang chiếm port 8081
$portPid = (Get-NetTCPConnection -LocalPort 8081 -State Listen).OwningProcess
Stop-Process -Id $portPid -Force
```

### ❌ Lỗi: Docker containers không start

```powershell
# Kiểm tra trạng thái tất cả containers
docker ps -a

# Start lại nếu container đã tồn tại (STATUS = Exited)
docker start kpi-postgres kpi-pgadmin

# Xóa hoàn toàn và tạo lại (nếu bị lỗi nặng)
docker rm -f kpi-postgres kpi-pgadmin
```

Sau khi xóa, chạy lại 2 lệnh `docker run` ở Bước 1.

### ❌ Lỗi: `column "role" does not exist`

Backend đang kết nối sai database. Kiểm tra:
1. `application-local.properties` có `localhost:5556/kpi_dev` chưa
2. Database đã chạy `init-db.sql` chưa (không phải `V1__create_schema.sql`)

### ❌ Lỗi: Frontend hiện `Unauthorized` hoặc không load data

- Kiểm tra backend đang chạy: mở **http://localhost:8081/api/actuator/health**
- Kiểm tra `.env` có `VITE_USE_MOCK=false`
- Restart frontend sau khi đổi `.env`

### ❌ Lỗi: Tên tiếng Việt hiển thị sai (ký tự lạ)

Khi paste SQL qua pgAdmin bị lỗi encoding. Thay vào đó, dùng **Docker exec** trong terminal:

```powershell
docker cp "d:\Projects\KPI-L\document\db\init-db.sql" kpi-postgres:/tmp/init-db.sql
docker exec -e PGPASSWORD=postgres kpi-postgres psql -U postgres -d kpi_dev -f /tmp/init-db.sql
```

```powershell
docker cp "d:\Projects\KPI-L\document\db\V3__sample_data.sql" kpi-postgres:/tmp/V3__sample_data.sql
docker exec -e PGPASSWORD=postgres kpi-postgres psql -U postgres -d kpi_dev -f /tmp/V3__sample_data.sql
```

> Phương pháp này đảm bảo file được đọc đúng UTF-8 từ disk, không qua clipboard.

---

## Tóm tắt lệnh — Chạy hàng ngày

Mỗi ngày làm việc, mở **3 terminal riêng biệt** trong VS Code/Cursor:

**Terminal 1 — Start Database:**
```powershell
docker start kpi-postgres kpi-pgadmin
```

**Terminal 2 — Start Backend:**
```powershell
cd d:\Projects\KPI-L\kpi-be
mvn "spring-boot:run" "-Dspring-boot.run.profiles=local"
```

**Terminal 3 — Start Frontend:**
```powershell
cd d:\Projects\KPI-L\kpi-fe
npm run dev
```

**Truy cập:** http://localhost:5173
