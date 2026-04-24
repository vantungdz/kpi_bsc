---
description: "This rule provides standards for backend generate source code"
alwaysApply: true
---

# KPI BACKEND CODE GENERATION (STRICT MODE + FINAL)

---

## 0. SYSTEM OVERRIDE (MUST FOLLOW)

* DO NOT use JPA / Hibernate
* Use MyBatis (XML-based)
* Entity MUST map 1:1 with table
* ALL relationships handled in Aggregate (DATA ONLY, NO LOGIC)
* Database structure MUST follow:
  `document/db/init-db.sql`

---

## 1. TECH STACK

* Java 21
* Spring Boot
* Maven
* MyBatis
* PostgreSQL
* Lombok (REQUIRED)

Root package:
`com.company.kpi`

---

## 2. PROJECT STRUCTURE (FULL — MUST FOLLOW EXACTLY)

```
src/main
├─ java
│  └─ com.company.kpi
│     ├─ aggregate/     # Data structures combining multiple entities (no logic)
│     ├─ common/
│     │  ├─ config/
│     │  │  ├─ CorsConfig.java
│     │  │  └─ SecurityConfig.java
│     │  ├─ constants/
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
```

---

# 🔥 DATABASE REFERENCE RULE (CRITICAL)

## ✅ MUST FOLLOW

All backend code MUST strictly follow database schema defined in:

```
document/db/init-db.sql
```

---

## ❌ FORBIDDEN

* Creating fields not defined in DB
* Renaming columns arbitrarily
* Guessing table structure
* Hardcoding assumptions about schema

---

## ✅ REQUIRED

* Column names MUST match DB (snake_case in SQL → camelCase in Java)
* Data types MUST match DB
* Primary key / foreign key MUST follow DB

---

# 🔥 ENTITY & MAPPER NAMING RULE (VERY IMPORTANT)

## ✅ RULE

* File name MUST be based on TABLE NAME
* NOT based on module / feature

---

## ✅ EXAMPLE

| Table Name        | Entity Class         | Mapper Interface           |
| ----------------- | -------------------- | -------------------------- |
| `users`           | `User.java`          | `UserMapper.java`          |
| `kpi_assignments` | `KpiAssignment.java` | `KpiAssignmentMapper.java` |

---

## ❌ WRONG

```java 
// ❌ WRONG - module-based naming
PmDashboardUser.java
KpiDashboardMapper.java
```

---

## ✅ ENTITY RULE

```java 
@Getter
@Setter
public class KpiAssignment {

    private UUID id;
    private UUID userId;
    private BigDecimal targetValue;
}
```

* 1 entity = 1 table
* NO nested object
* FK = ID only

---

## ✅ MAPPER RULE

```java 
@Mapper
public interface KpiAssignmentMapper {

    List<KpiAssignment> findByUserId(UUID userId);
}
```

* Interface ONLY
* SQL in XML
* Method name reflects query purpose
* Can return:

  * Entity
  * Aggregate (for complex query)

---

# 🔥 AGGREGATE DEFINITION (VERY IMPORTANT)

## ✅ Purpose

Aggregate is a **DATA STRUCTURE ONLY** used to:

* Combine multiple entities
* Represent joined data
* Act as read model (projection)

---

## ❌ STRICTLY FORBIDDEN

Aggregate MUST NOT contain:

* Business logic
* Calculations
* Mapping logic
* Service methods

---

## ✅ EXAMPLE

```java 
@Getter
@Setter
public class PmDashboardAggregate {

    private List<KpiAssignment> assignments;
    private List<User> members;
}
```

---

# 🔥 DATA FLOW RULE

```
Controller
   ↓
Service (BUSINESS LOGIC)
   ↓
Mapper (SQL)
   ↓
Aggregate (DATA ONLY)
   ↓
Service (process & map DTO)
```

---

# 🔥 LOMBOK RULE (MANDATORY)

## ✅ ENTITY

* Use:

  * `@Data`

## ❌ DO NOT USE

* `@Builder`

---

## ✅ AGGREGATE

* Use:

  * `@Data`

---

## ✅ RESPONSE DTO

* MUST use:

  * `@Builder`
  * `@Getter`

---

## ⚠️ LIST DEFAULT

```java 
@Builder.Default
private List<Item> items = new ArrayList<>();
```

---

# 🔥 SERVICE RULE

* Contains ALL business logic
* Build KPI tree
* Calculate progress
* Map DTO

## ❌ MUST NOT

* Contain SQL
* Return Entity

---

# 🔥 CONTROLLER RULE

* Role-based (pm/gm/member)
* ONLY call Service
* NEVER call Mapper
* NEVER return Entity

---

# ❌ FORBIDDEN STRUCTURE

* JPA / Hibernate
* SQL in Service
* Business logic in Aggregate
* Module-based naming for Entity/Mapper
* Using @Data in Entity
* Using @Builder in Entity
* Creating Repository layer

---

# ✅ FINAL PRINCIPLE

* Entity = DB mapping (STRICT)
* Mapper = DB access
* Aggregate = Data combination
* Service = Logic
* Controller = API

---

# ⚠️ IF UNCERTAIN

* ALWAYS refer to `init-db.sql`
* DO NOT invent schema
* DO NOT rename tables/columns
* KEEP STRICT LAYER SEPARATION
