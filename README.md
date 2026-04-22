# KPI Management System

Hệ thống quản lý và đánh giá KPI nhân viên.

**Stack:** Vue 3 + Vite + Tailwind CSS · Spring Boot 3 + MyBatis · PostgreSQL 16 · Redis 7 · Docker Compose

---

## Mục lục

- [Tài khoản demo](#tài-khoản-demo)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cách 1 — Frontend Mock (không cần backend)](#cách-1--frontend-mock-không-cần-backend)
- [Cách 2 — Đầy đủ: Frontend + Backend + Docker](#cách-2--đầy-đủ-frontend--backend--docker)
- [Xử lý lỗi Docker Hub timeout](#xử-lý-lỗi-docker-hub-timeout)
- [API Endpoints](#api-endpoints)
- [Biến môi trường](#biến-môi-trường)

---

## Tài khoản demo

| Role   | Email              | Mật khẩu  | Quyền                             |
|--------|--------------------|-----------|-----------------------------------|
| GM     | gm@kpi.com         | Abc@12345 | Xem tổng quan toàn công ty        |
| PM     | pm@kpi.com         | Abc@12345 | Quản lý & chấm điểm KPI team     |
| Leader | leader@kpi.com     | Abc@12345 | Chấm điểm KPI members trong nhóm |
| Member | member@kpi.com     | Abc@12345 | Tự đánh giá KPI cá nhân          |

---

## Cấu trúc thư mục

```
kpi/
├── kpi-fe/                  # Vue 3 frontend
├── kpi-be/                  # Spring Boot backend
│   └── src/main/resources/
│       ├── db/migration/    # V1__create_schema.sql
│       └── db/seed/         # V2__seed_data.sql
├── layout/                  # HTML prototype (tham khảo)
├── pgadmin-servers.json     # Config kết nối pgAdmin tự động
├── docker-compose.yml
├── .env.example
├── README.md
└── setup-db.md
```

---

## Cách 1 — Frontend Mock (không cần backend)

> Phù hợp khi chỉ muốn xem giao diện, không cần cài Java, PostgreSQL hay Docker.

### Yêu cầu

- Node.js ≥ 18

### Các bước

```bash
# 1. Vào thư mục frontend
cd kpi-fe

# 2. Cài dependencies (chỉ cần làm 1 lần)
npm install

# 3. Chạy với mock data
npm run dev-mock
```

Truy cập: **[http://localhost:5173](http://localhost:5173)**

Click vào các nút demo (**GM / PM / Leader / Member**) để tự động điền tài khoản, rồi nhấn **Đăng nhập**.

> **Mock mode** không gọi API thực — data được lấy từ `src/mocks/`. Mọi thay đổi (chấm điểm, submit...) chỉ tồn tại trong bộ nhớ, không lưu database.

---

## Cách 2 — Đầy đủ: Frontend + Backend + Docker

> Chạy toàn bộ hệ thống với database thực, bao gồm pgAdmin 4 để quản lý DB qua trình duyệt.

### Yêu cầu

- Node.js ≥ 18
- Java 21
- Maven 3.9+
- Docker Desktop đang chạy

### Tổng quan kiến trúc

```
Browser (localhost:5173)
    └─► Vite Dev Server (proxy /api → localhost:8081)
            └─► Spring Boot Backend (localhost:8081)
                    ├─► PostgreSQL (Docker, localhost:5556)
                    └─► Redis      (Docker, localhost:6380)

pgAdmin 4 (localhost:5050) ──────────► PostgreSQL (Docker)
```

---

### Bước 1 — Tạo file cấu hình

```bash
# Từ thư mục gốc kpi/
cp .env.example .env
```

> File `.env` đã có giá trị mặc định sẵn dùng, không cần chỉnh thêm.

---

### Bước 2 — Khởi động Docker (PostgreSQL + Redis + pgAdmin)

```bash
# Khởi động database, redis và pgAdmin
docker-compose --profile tools up -d

# Kiểm tra trạng thái — tất cả phải ở trạng thái "healthy" hoặc "Up"
docker-compose --profile tools ps
```

Kết quả mong đợi:

```
NAMES          STATUS                   PORTS
kpi-postgres   Up ... (healthy)         0.0.0.0:5556->5432/tcp
kpi-redis      Up ... (healthy)         0.0.0.0:6380->6379/tcp
kpi-pgadmin    Up ...                   0.0.0.0:5050->80/tcp
```

> **pgAdmin 4** truy cập tại [http://localhost:5050](http://localhost:5050)  
> Email: `admin@kpi.dev` | Password: `admin123`  
> Server **"KPI PostgreSQL"** đã được cấu hình sẵn, chỉ cần click để kết nối.

---

### Bước 3 — Khởi động Backend (Spring Boot)

```bash
cd kpi-be
mvn spring-boot:run
```

Đợi đến khi thấy dòng log:
```
Started KpiApplication in X.XXX seconds
```

Backend chạy tại: **[http://localhost:8081/api](http://localhost:8081/api)**

> **Lưu ý:** Lần đầu chạy, Maven sẽ tải dependencies (~vài phút). Các lần sau sẽ nhanh hơn.

---

### Bước 4 — Khởi động Frontend

Mở terminal mới:

```bash
cd kpi-fe

# Cài dependencies (chỉ cần làm 1 lần)
npm install

# Chạy frontend kết nối với backend thực
npm run dev
```

Truy cập: **[http://localhost:5173](http://localhost:5173)**

Đăng nhập với tài khoản trong [bảng Roles](#tài-khoản-demo) ở trên.

---

### Bước 5 — Kiểm tra hoạt động

```bash
# Test API login (từ terminal bất kỳ)
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gm@kpi.com","password":"Abc@12345"}'

# Xem logs backend
docker-compose logs -f kpi-be    # nếu dùng Docker backend
# hoặc xem trực tiếp terminal đang chạy mvn spring-boot:run
```

---

### Dừng hệ thống

```bash
# Dừng Docker containers
docker-compose --profile tools down

# Dừng backend: Ctrl+C trong terminal đang chạy mvn spring-boot:run
# Dừng frontend: Ctrl+C trong terminal đang chạy npm run dev
```

---

### (Tuỳ chọn) Chạy Backend trong Docker thay vì local

Nếu muốn backend cũng chạy trong Docker (yêu cầu Docker Hub hoặc mirror):

```bash
docker-compose --profile tools --profile backend up -d
```

> Xem [Xử lý lỗi Docker Hub timeout](#xử-lý-lỗi-docker-hub-timeout) nếu gặp lỗi pull image.

---

## Xử lý lỗi Docker Hub timeout

Nếu gặp lỗi `i/o timeout` khi pull image, mạng đang bị chặn Docker Hub.

**Thêm registry mirrors vào `~/.docker/daemon.json`:**

```json
{
  "registry-mirrors": [
    "https://dockerproxy.com",
    "https://docker.1ms.run",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

**Sau đó Restart Docker Desktop** (tray icon → Quit → mở lại).

Kiểm tra mirror đã áp dụng:
```bash
docker info | grep -A5 "Registry Mirrors"
```

---

## API Endpoints

| Method | Endpoint                                               | Role   |
|--------|--------------------------------------------------------|--------|
| POST   | `/api/v1/auth/login`                                   | All    |
| POST   | `/api/v1/auth/refresh`                                 | All    |
| POST   | `/api/v1/auth/logout`                                  | All    |
| GET    | `/api/v1/gm/kpi/dashboard?year=2026`                   | GM     |
| GET    | `/api/v1/member/kpi/dashboard?year=2026`               | MEMBER |
| PUT    | `/api/v1/member/kpi/items/{itemId}/score`              | MEMBER |
| POST   | `/api/v1/member/kpi/draft`                             | MEMBER |
| POST   | `/api/v1/member/kpi/submit`                            | MEMBER |
| GET    | `/api/v1/leader/kpi/dashboard?year=2026`               | LEADER |
| PUT    | `/api/v1/leader/kpi/members/{id}/items/{itemId}/score` | LEADER |
| GET    | `/api/v1/pm/kpi/dashboard?year=2026`                   | PM     |
| PUT    | `/api/v1/pm/kpi/members/{id}/items/{itemId}/score`     | PM     |
| POST   | `/api/v1/pm/kpi/members/{id}/approve`                  | PM     |

---

## Biến môi trường

### Frontend (`kpi-fe/.env`)

| Biến                | Giá trị mặc định | Mô tả                                        |
|---------------------|------------------|----------------------------------------------|
| `VITE_API_BASE_URL` | `/api/v1`        | Base URL — dùng relative để qua Vite proxy  |
| `VITE_USE_MOCK`     | `false`          | `true` để bật mock adapter (không cần BE)   |

> `npm run dev-mock` tự động set `VITE_USE_MOCK=true` qua file `.env.mock`.

### Backend / Docker (`.env`)

| Biến                | Mặc định    | Mô tả                          |
|---------------------|-------------|--------------------------------|
| `POSTGRES_USER`     | `postgres`  | PostgreSQL username            |
| `POSTGRES_PASSWORD` | `postgres`  | PostgreSQL password            |
| `POSTGRES_DB`       | `kpi_dev`   | Tên database                   |
| `POSTGRES_PORT`     | `5556`      | Host port cho PostgreSQL       |
| `REDIS_PORT`        | `6380`      | Host port cho Redis            |
| `BACKEND_PORT`      | `8081`      | Host port cho Spring Boot      |
| `PGADMIN_EMAIL`     | `admin@kpi.dev` | Email đăng nhập pgAdmin    |
| `PGADMIN_PASSWORD`  | `admin123`  | Password đăng nhập pgAdmin     |
| `PGADMIN_PORT`      | `5050`      | Host port cho pgAdmin          |
| `JWT_SECRET`        | *(xem file)*| Secret key cho JWT token       |
