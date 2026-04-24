# Tổng quan backend `kpi-be`

Dự án là **Spring Boot 3.3** (Java 21), REST API, bảo mật **Spring Security + JWT**, truy cập DB **PostgreSQL** qua **MyBatis**. Profile mặc định: `local` (xem `application.properties`).

---

## API được khai báo ở đâu?

**Các endpoint HTTP được định nghĩa trong các lớp `@RestController`** dưới thư mục:

`src/main/java/com/company/kpi/controller/`

| File | Vai trò |
|------|---------|
| `controller/auth/AuthController.java` | Đăng nhập, refresh token, logout |
| `controller/gm/GmKpiController.java` | Dashboard GM, dữ liệu KPI năm (catalog + diagnostics), member theo section |
| `controller/pm/PmKpiController.java` | Dashboard PM, chấm điểm PM, duyệt sheet |
| `controller/leader/LeaderKpiController.java` | Dashboard Leader, chấm điểm Leader |
| `controller/member/MemberKpiController.java` | Dashboard member, tự chấm, submit, save draft |

Luồng xử lý điển hình: **Controller** → gọi **Service** (`service/...`) → **Mapper** (interface Java + XML SQL trong `resources/mappers/`).

**Tiền tố URL đầy đủ:** trong `application-local.properties` có `server.servlet.context-path=/api`, còn controller dùng `@RequestMapping("/v1/...")`, nên base URL ví dụ: `http://localhost:8081/api/v1/...`.

---

## Danh sách endpoint (theo code hiện tại)

### Auth — `AuthController` (`/v1/auth`)

| Method | Đường dẫn tương đối | Mô tả |
|--------|---------------------|--------|
| POST | `/v1/auth/login` | Đăng nhập |
| POST | `/v1/auth/refresh` | Làm mới access token |
| POST | `/v1/auth/logout` | Đăng xuất (vô hiệu refresh token) |

Các URL trên **không cần JWT** (cấu hình trong `SecurityConfig`).

### GM — `GmKpiController` (`/v1/kpi/gm`) — role `GM`

| Method | Đường dẫn | Mô tả |
|--------|-----------|--------|
| GET | `/v1/kpi/gm/dashboard?year=` | Dashboard GM |
| GET | `/v1/kpi/gm/diagnostics-hierarchy?year=` | **Một API:** `catalogItems` (thư viện KPI kỳ) + `kpis` (cây đơn vị / assignment). `year` mặc định = năm hiện tại (`GmDiagnosticsHierarchyResponse`) |
| GET | `/v1/kpi/gm/kpi-categories` | Danh sách `kpi_categories` (dropdown nhóm KPI) |
| GET | `/v1/kpi/gm/kpi-cycles-with-kpis` | Chu kỳ `kpi_cycles` có dữ liệu KPI (`kpis_information` / `kpi_assignments` / `user_kpi_summaries`) — năm nguồn sao chép trên FE |
| GET | `/v1/kpi/gm/sections/{sectionId}/members?year=` | Member trong section |
| POST | `/v1/kpi/gm/strategic-kpis` | GM tạo KPI chiến lược (`kpi_master` + `kpis_information` + `kpi_assignments`) |

### PM — `PmKpiController` (`/v1/kpi/pm`) — role `PM` hoặc `GM`

| Method | Đường dẫn | Mô tả |
|--------|-----------|--------|
| GET | `/v1/kpi/pm/dashboard?year=` | Dashboard PM |
| PUT | `/v1/kpi/pm/sheet/{memberId}/{itemId}` | Cập nhật điểm PM cho một KPI item |
| POST | `/v1/kpi/pm/sheet/{memberId}/approve` | Duyệt sheet |

### Leader — `LeaderKpiController` (`/v1/kpi/leader`) — `LEADER`, `PM`, `GM`

| Method | Đường dẫn | Mô tả |
|--------|-----------|--------|
| GET | `/v1/kpi/leader/dashboard?year=` | Dashboard Leader |
| PUT | `/v1/kpi/leader/sheet/{memberId}/{itemId}` | Cập nhật điểm Leader |

### Member — `MemberKpiController` (`/v1/kpi/member`) — `MEMBER`, `LEADER`, `PM`, `GM`

| Method | Đường dẫn | Mô tả |
|--------|-----------|--------|
| GET | `/v1/kpi/member/dashboard?year=` | Dashboard (lấy `userId` từ JWT) |
| PUT | `/v1/kpi/member/kpi` | Trong code có `@PathVariable UUID itemId` nhưng path mapping **không** chứa `{itemId}` — cần chỉnh mapping cho khớp (ví dụ `/sheet/{itemId}`) nếu gọi API bị lỗi |
| POST | `/v1/kpi/member/evidences/submit` | Submit đánh giá |
| POST | `/v1/kpi/member/sheet/save-draft` | Lưu nháp sheet |

---

## Cấu trúc thư mục Java (`com.company.kpi`)

| Thư mục / file | Mục đích |
|----------------|----------|
| `KpiApplication.java` | Hàm `main`, khởi động Spring Boot |
| `controller/` | REST API: nhận request, validate input, trả `ResponseEntity` |
| `controller/base/BaseController.java` | Helper `success()`, `created()` bọc body trong `BaseResponse` |
| `service/` | Logic nghiệp vụ (auth, gm, pm, leader, member) |
| `mapper/` | Interface MyBatis — ánh xạ method → statement id trong XML |
| `entity/` | POJO ánh xạ bảng DB (`User`, `KpiSheet`, `KpiAssignment`, …) |
| `entity/base/BaseEntity.java` | Trường chung cho entity (nếu có created/updated, v.v.) |
| `request/` | DTO **đầu vào** API (login, score, approve, draft, …) |
| `response/` | DTO **đầu ra** API (dashboard từng role, token, sheet, …) |
| `common/dto/BaseResponse.java` | Envelope JSON chuẩn: `success`, `message`, `status`, `data`, … |
| `common/config/SecurityConfig.java` | Stateless JWT, mở `/v1/auth/**`, `/actuator/**`, còn lại cần đăng nhập |
| `common/config/CorsConfig.java` | CORS cho frontend |
| `common/security/JwtAuthFilter.java` | Đọc Bearer token, set `Authentication` (principal = userId, authority = role) |
| `common/util/JwtUtil.java` | Tạo / parse / validate JWT |
| `common/util/Utilitils.java` | Tiện ích chung (tên file đúng chính tả trong repo) |
| `common/exception/AppException.java` | Exception nghiệp vụ tùy chỉnh |
| `common/exception/GlobalExceptionHandler.java` | `@ControllerAdvice` — map exception → HTTP + `BaseResponse` |
| `common/constant/Constant.java` | Hằng số dùng chung |
| `common/mybatis/UUIDTypeHandler.java` | TypeHandler MyBatis cho UUID |
| `aggregate/` | Giữ `.gitkeep` — dự phòng cho tầng tổng hợp/read model |

---

## Tài nguyên (`src/main/resources`)

| File / thư mục | Mục đích |
|----------------|----------|
| `application.properties` | Tên app, profile active (`local`) |
| `application-local.properties` | DB, port `8081`, `context-path=/api`, MyBatis, JWT, logging |
| `mappers/*.xml` | SQL MyBatis: `UserMapper.xml`, `KpiCycleMapper.xml`, `KpiAssignmentMapper.xml` |

---

## File gốc project

| File | Mục đích |
|------|----------|
| `pom.xml` | Dependencies: Web, Validation, Security, Actuator, MyBatis, PostgreSQL, JWT (jjwt), Lombok |
| `Dockerfile` | Build / chạy container cho backend |
| `README.md` | Hướng dẫn có sẵn của repo |
| `.gitignore` | Loại trừ build, IDE, … |

---

## Bảo mật và role

- **Filter:** `JwtAuthFilter` chạy trước filter mặc định của Spring Security.
- **Phân quyền:** `@PreAuthorize` trên từng controller KPI (ví dụ GM chỉ `hasRole('GM')`).
- Role trong JWT được gắn prefix `ROLE_` để khớp với `hasRole('GM')`, v.v.

---

## Tóm tắt

| Câu hỏi | Trả lời ngắn |
|---------|----------------|
| API viết ở đâu? | `src/main/java/com/company/kpi/controller/**/*.java` |
| Logic nghiệp vụ? | `service/**/*.java` |
| Truy vấn SQL? | `mapper/*.java` + `resources/mappers/*.xml` |
| Cấu hình server & DB? | `resources/application*.properties` |
| JWT & Security? | `common/config/SecurityConfig.java`, `common/security/JwtAuthFilter.java`, `common/util/JwtUtil.java` |

*Tài liệu này mô tả theo trạng thái codebase tại thời điểm tạo file; nếu chỉnh controller, hãy cập nhật bảng endpoint tương ứng.*

