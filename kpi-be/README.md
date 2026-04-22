# README — Backend (kpi-be)

Tệp này chứa cây thư mục chính của backend và ghi nhận đánh giá cấu trúc hiện tại.

## Tổng quan nhanh

- Stack: Java 21+ (Spring Boot), Maven.
- Root package: `com.company.kpi`.

## Cây thư mục (trích chọn từ `src/main`)

```
src/main
├─ java
│  └─ com.company.kpi
│     ├─ aggregate/
│     ├─ common/
│     │  ├─ config/
│     │  │  ├─ CorsConfig.java
│     │  │  └─ SecurityConfig.java
│     │  ├─ dto/
│     │  ├─ exception/
│     │  ├─ mybatis/
│     │  ├─ security/
│     │  └─ util/
│     ├─ controller/
│     │  ├─ auth/
│     │  ├─ base/
│     │  ├─ gm/
│     │  ├─ leader/
│     │  ├─ member/
│     │  └─ pm/
│     ├─ entity/
│     │  ├─ base/
│     │  ├─ KpiItem.java
│     │  ├─ KpiPeriod.java
│     │  ├─ KpiSheet.java
│     │  ├─ RefreshToken.java
│     │  └─ User.java
│     ├─ mapper/
│     │  ├─ RefreshTokenMapper.java
│     │  └─ UserMapper.java
│     ├─ request/
│     │  ├─ auth/
│     │  ├─ leader/
│     │  ├─ member/
│     │  └─ pm/
│     ├─ response/
│     │  ├─ auth/
│     │  ├─ gm/
│     │  ├─ leader/
│     │  ├─ member/
│     │  └─ pm/
│     ├─ service/
│     │  ├─ auth/
│     │  ├─ gm/
│     │  ├─ leader/
│     │  ├─ member/
│     │  └─ pm/
│     └─ KpiApplication.java
└─ resources
	├─ application.properties
	├─ application-local.properties
	└─ db
        ├─ migration
        │  └─ V1__create_schema.sql
        └─ seed
            └─ V2__seed_data.sql
```

## Lệnh nhanh

Build:

```bash
mvn clean package -DskipTests
```

Chạy local (profile `local`):

```bash
mvn spring-boot:run
```