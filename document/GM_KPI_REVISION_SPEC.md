# GM sửa KPI (PM / Leader / Member) — Đặc tả triển khai

**Phiên bản:** draft (confirm trước khi code)  
**Ngày:** 2026-05-22  
**Trạng thái hiện tại:** GM `updateStrategicKpi` chỉ cập nhật master/info; **không** bắt owner xác nhận lại; cascade member có thể bị đổi `target_value` ngầm qua `updateAssignmentTargetsMatchingCatalog`.

---

## 1. Mục tiêu cập nhật

### 1.1 Nghiệp vụ

| # | Mục tiêu |
|---|----------|
| G1 | GM được sửa KPI do **PM / Leader / Member** tạo (giữ quyền GM cao nhất). |
| G2 | Sau khi GM **Save** thay đổi định nghĩa KPI → **owner assignment bắt buộc xác nhận lại target** (không có checkbox tắt). |
| G3 | Khi xác nhận: **giữ** `mid_self_score`, `end_self_score`, `evidences`, `end_pm_score`, `end_gm_score`; chỉ chốt lại mục tiêu. |
| G4 | Sau xác nhận: `status_code` **quay về status trước khi GM sửa** (vd. 502 → 502, 503 → 503), **không** dùng luồng Accept chuẩn 404→405 cho revision này. |
| G5 | **KPI Team (PM):** GM sửa **không ảnh hưởng** member cascade đang thực hiện (≥405, 501–602…): không reset status, không ép Accept, không propagate target xuống con. Chỉ **assignment gốc PM** (`parent_assignment_id IS NULL`) vào luồng revision. |
| G6 | **GM Unlock** (Evaluation Hub): đồng bộ logic lưu `status_before` + confirm restore; unlock **503 được**, **603 không** (giữ như BE hiện tại). |
| G7 | Thông báo UI: badge / status label / banner tab / drawer diff — **không đổi màu nền dòng** (`kpiCreatorRowBg` vẫn phân biệt người tạo KPI). |

### 1.2 Phạm vi “GM sửa KPI” kích hoạt revision

Đề xuất: bất kỳ thay đổi có ý nghĩa trên `kpi_master` / `kpis_information` khi `preserveAssignmentsOnGmEdit = true`:

- `kpiName`, `targetValue` (catalog), `weightPct`, `targetDescription` (scoring rules), `unitCode`, `calculationMethod`, `isImportant`, `perspective` (category).

*(Chỉ sửa typo không đổi dữ liệu → có thể bỏ qua revision nếu BE so sánh deep-equal; mặc định: có diff → revision.)*

### 1.3 Không nằm trong phase đầu (tuỳ chọn sau)

- Bảng audit đầy đủ `kpi_change_log` (Phase 2).
- Email / push notification.
- Checkbox “require re-accept” (đã loại — luôn bắt buộc với owner).

---

## 2. Hiện trạng vs mục tiêu

| Hành vi | Hiện tại | Sau triển khai |
|---------|----------|----------------|
| GM edit non-GM KPI | `status` giữ nguyên | Owner → **404** + `status_before_gm_revision` |
| Propagate catalog target | Update mọi ASM cùng `kpi_info_id` (kể cả cascade) | Team: **chỉ root PM** hoặc không propagate xuống con |
| Member dưới KPI Team | Có thể đổi `target_value` ngầm | **Không đổi** status/target |
| Accept sau GM edit | Không có | API **confirm-gm-revision** → restore status cũ |
| GM Unlock 503 | Được (SQL không loại 503) | + lưu `status_before`; confirm restore |
| UI thông báo | Không | Badge + label + drawer (không đổi row bg creator) |

---

## 3. Database

### 3.1 Bảng cần sửa: `kpi_assignments`

Thêm cột (migration mới, ví dụ `document/db/V7__gm_kpi_revision_columns.sql`):

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `status_before_gm_revision` | `INTEGER NULL` | FK logic tới `sys_status_codes` (501, 502, 503, 601, 602, 405, …) |
| `gm_revision_at` | `TIMESTAMPTZ NULL` | Thời điểm GM/unlock đưa về 404 |
| `gm_revision_by` | `UUID NULL` | `users.id` GM |
| `gm_revision_reason` | `TEXT NULL` | Lý do GM nhập khi Save (optional) |

**Ràng buộc logic (application):**

- Chỉ set khi `status_code` chuyển → **404** vì GM revision / unlock.
- Clear khi owner **confirm** thành công.
- `status_before_gm_revision IS NOT NULL` + `status_code = 404` ⇒ phân biệt với 404 “giao việc lần đầu” (Accept 404→405).

Cập nhật `document/db/init-db.sql` cho DB mới (đồng bộ schema gốc).

### 3.2 Bảng không đổi (phase 1)

- `kpi_master`, `kpis_information` — chỉ đọc/ghi như hiện tại.
- `sys_status_codes` — không thêm code mới (dùng lại 404 + status cũ lưu trong cột mới).

### 3.3 Index (khuyến nghị)

```sql
CREATE INDEX idx_kpi_assign_gm_revision_pending
  ON kpi_assignments (cycle_id, user_id)
  WHERE deleted_at IS NULL
    AND status_code = 404
    AND status_before_gm_revision IS NOT NULL;
```

---

## 4. Backend — file & hàm

### 4.1 Migration & entity

| File | Thay đổi |
|------|----------|
| `document/db/V7__gm_kpi_revision_columns.sql` | **Thêm** ALTER `kpi_assignments` |
| `document/db/init-db.sql` | **Sửa** định nghĩa `kpi_assignments` |
| `kpi-be/.../entity/KpiAssignment.java` (nếu có) | Map 4 cột mới |

### 4.2 Mapper / SQL

| File | Thay đổi |
|------|----------|
| `kpi-be/.../mapper/KpiAssignmentMapper.java` | **Thêm** method: `applyGmRevisionReset`, `confirmGmRevision`, `listPendingGmRevisionByUser`, … |
| `kpi-be/.../resources/mappers/KpiAssignmentMapper.xml` | **Sửa** `unlockGmEvaluationHubAcceptedAssignments`, `unlockGmEvaluationHubPmTeamCascadeChildren` — SET `status_before_gm_revision = status_code` trước khi `404` |
| | **Sửa** `updateAssignmentTargetsMatchingCatalog` — thêm điều kiện `parent_assignment_id IS NULL` khi GM edit Team (hoặc tách query `updateRootAssignmentTargetsMatchingCatalog`) |
| | **Thêm** UPDATE confirm: `status_code = status_before_gm_revision`, clear revision columns |

### 4.3 Service

| File | Hàm / vùng | Thay đổi |
|------|------------|----------|
| `StrategicKpiService.java` | `update(...)` | Sau khi GM save + `preserveAssignmentsOnGmEdit`: gọi **apply revision** cho danh sách assignment owner (xem §4.4). Trả `revisionCount` trong response (mở rộng DTO). |
| | `propagateCatalogTargetToMatchingAssignments` | Team KPI: **không** update cascade children |
| | **Thêm** `applyGmRevisionAfterStrategicEdit(...)` | Chọn assignment, set 404 + before + reason |
| `GmEvaluationHubService.java` | `unlockAcceptedKpis` | Cùng logic `status_before` (unlock không xóa score) |
| **Thêm** `GmKpiRevisionService.java` (hoặc gộp `MemberKpiService`) | `confirmGmRevision(assignmentId, userId)` | Validate owner + flag; restore status; **không** xóa score |
| `MemberKpiService.java` | `submitMemberSheet` (`target_setup`) | **Không** xử lý ASM có `status_before_gm_revision` như 404→402/405 thường — tách luồng confirm |
| `PmDashboardService.java` | Portfolio / accept PM | PM confirm revision trên KPI Team gốc & personal |
| `LeaderKpiService` / tương đương | Nếu Leader có portfolio API | Confirm revision cho assignment Leader |

### 4.4 Quy tắc chọn assignment khi GM Save

```
IF kpi_master.type = TEAM (102):
  Chỉ các assignment:
    - kpi_info_id = edited
    - parent_assignment_id IS NULL
    - user_id = PM owner (creator hoặc assignee gốc trong cycle)
  LOẠI TRỪ mọi dòng parent_assignment_id IS NOT NULL (member cascade)

ELSE (INDIVIDUAL / PROMOTION):
  Assignment root của owner (member/leader/PM) cùng kpi_info_id + cycle
```

**Không** reset cascade children dù catalog target đổi.

### 4.5 Controller & API mới

| Method | Path (đề xuất) | Mô tả |
|--------|----------------|--------|
| `PUT` | `/api/v1/kpi/strategic-kpis/{id}` | Mở rộng body: `gmRevisionReason?: string`; response: `assignmentsPendingConfirmation: number` |
| `POST` | `/api/v1/kpi/assignments/{assignmentId}/confirm-gm-revision` | Member/PM/Leader confirm (hoặc `/member/...`, `/pm/...` theo convention repo) |
| `POST` | `/api/v1/kpi/gm/evaluation-hub/unlock` | Giữ path; BE lưu `status_before` |

**Request confirm:** có thể rỗng hoặc `{ "cycleId": "..." }` để chống nhầm cycle.

### 4.6 Response DTO (đọc dashboard)

| File | Field mới (gợi ý) |
|------|-------------------|
| `MemberKpiAssignmentDTO.java` | `gmRevisionPending`, `statusBeforeGmRevision`, `gmRevisionReason`, `gmRevisionAt` |
| `PmDashboardResponse.java` (portfolio item) | Tương tự |
| `LeaderKpiInformationResponse` / assignment row | Tương tự |
| `StrategicKpiResponse.java` | `assignmentsPendingConfirmation` sau GM update |

Mapper XML cho `findDetailsByUserAndCycle`, PM portfolio, Leader list — SELECT thêm 4 cột revision.

---

## 5. Frontend — file & hàm

### 5.1 GM

| File | Thay đổi |
|------|----------|
| `GmCreateStrategicKpiModal.vue` | Textarea **Lý do chỉnh sửa** (optional); gửi trong payload update; toast sau save: *"Đã cập nhật. N assignment cần xác nhận target"* |
| `GmLayout.vue` | Xử lý response `assignmentsPendingConfirmation` từ `updateStrategicKpi` |
| `kpi-gm.service.ts` | Type request/response; không gửi `assignPMs` khi edit non-GM (giữ `mapStrategicKpiCreatePayloadToApi.ts`) |
| `mapStrategicKpiCreatePayloadToApi.ts` | `gmRevisionReason` field |

**Không** thêm checkbox require re-accept.

### 5.2 Member

| File | Thay đổi |
|------|----------|
| `MemberDashboard.vue` | Banner khi có `gmRevisionPending` |
| `MemberKpiPersonalTab.vue` / `MemberKpiPromotionTab.vue` | Badge cạnh status; **không** đổi `rowClass` / `kpiCreatorRowBgFromSource` |
| Drawer evidence / KPI detail | Block diff target + lý do GM; nút **Confirm target** → API confirm (không dùng Submit sheet 404→405) |
| `kpi-member.service.ts` | `confirmGmRevision(assignmentId)` |

### 5.3 PM

| File | Thay đổi |
|------|----------|
| `PmPersonalKpiTab.vue` | Confirm revision cho KPI Team gốc / personal PM |
| `PmAssignKpiDrawer.vue` | Giữ logic allocation (đã có `allocationSaveBlockedReason` cho removal) — **không** nhầm với GM revision |
| `PmDashboard.vue` | Refetch sau confirm |
| `kpi-pm.service.ts` | API confirm |

**Lưu ý:** PM **Unlock** (`UNLOCK_FROM_GM_WAITING_STATUSES` — không có 503) là luồng **khác** GM revision; không gộp UI.

### 5.4 Leader

| File | Thay đổi |
|------|----------|
| `LeaderManager.vue` | Banner + confirm tương tự Member |
| `PersonalKpiTable.vue` / `PromotionKpiTable.vue` | Badge status; giữ `kpiCreatorRowBgFromSource` |
| Leader service module | API confirm |

### 5.5 Shared

| File | Thay đổi |
|------|----------|
| `config/constants.ts` | Helper `isGmRevisionPending(item)` |
| `types/...` | Interface fields revision |
| **Không sửa** `kpiCreatorRowBg.ts` | Màu creator giữ nguyên |

---

## 6. Luồng trạng thái (tóm tắt)

```text
[Đang 502] --GM Save edit--> status_before=502, status=404
[404 + before=502] --Owner Confirm--> status=502 (scores giữ)

[Member cascade 502] --GM Save KPI Team--> KHÔNG ĐỔI (vẫn 502)

[503] --GM Unlock Hub--> before=503, status=404 --Confirm--> 503
[603] --GM Unlock--> KHÔNG (excluded SQL)
```

**Phân biệt 404:**

| Loại | `status_before_gm_revision` | Accept |
|------|----------------------------|--------|
| Giao KPI mới / setup | `NULL` | `target_setup` → 405 hoặc 402 (self-created) |
| GM revision / unlock restore | `NOT NULL` | `confirm-gm-revision` → restore before |

---

## 7. Regression — luồng cũ không được phá

| Luồng | Cách bảo vệ |
|-------|-------------|
| Member `target_setup` 404→405 | Chỉ áp dụng khi `status_before_gm_revision IS NULL` |
| PM Accept 404→403 (personal, chờ GM) | Không set `status_before` trên luồng PM gửi GM |
| PM cascade phân bổ (`assignToMembers`) | Không đổi; member ≥405 vẫn locked như `isCascadeChildAllocationLocked` |
| GM Approved queue 403→405/406 | Không dùng cột revision |
| Feedback 407→404 | Không ghi đè `status_before` nếu đã có revision pending |
| `bulkAcceptPendingForSubmit` | Không gọi cho ASM revision pending |
| GM edit KPI do **GM** tạo | `preserveAssignmentsOnGmEdit = false` — hành vi sync assignment **giữ nguyên** |
| PM/Leader/Member **tự** `updateStrategicKpi` | Không trigger GM revision |
| Evaluation submit 405→501, 502→503, … | Chỉ chạy khi không stuck ở revision 404 sai luồng |
| Team parent sync 502/503 (`cascadeGmEvaluationHubTeamSlice*`) | Không đổi; confirm revision chỉ trên assignment được chọn |

### 7.1 Test checklist

1. GM sửa KPI Individual member đang **502** → member **404**, confirm → **502**, điểm giữ.
2. GM sửa KPI Team → PM **404**, member A **502** không đổi.
3. GM sửa Team → propagate **không** đổi `target_value` member con.
4. Member KPI **404 lần đầu** (không có `status_before`) → Submit target_setup vẫn → **405**.
5. GM Unlock **503** → confirm → **503**; Unlock **603** fail.
6. PM Unlock **403** (dashboard) — không regression.
7. `PmAssignKpiDrawer` save allocation sau GM unlock PM — vẫn save được khi gỡ PM khỏi team (fix `allocationSaveBlockedReason` removals).

---

## 8. Thứ tự triển khai đề xuất

1. **DB** migration + `init-db.sql`
2. **BE** mapper unlock + revision apply + confirm API
3. **BE** `StrategicKpiService.update` + sửa propagate catalog
4. **BE** expose fields trên Member/PM/Leader dashboard queries
5. **FE** GM modal (reason + toast)
6. **FE** Member → PM → Leader (confirm + UI)
7. **FE** Evaluation Hub (unlock dùng chung confirm nếu cùng 404+before)
8. QA theo §7.1

---

## 9. Tham chiếu code hiện tại

| Chủ đề | Vị trí |
|--------|--------|
| GM edit preserve assignment | `StrategicKpiService.shouldPreserveAssignmentsOnGmEdit`, `update()` |
| Propagate target (rủi ro cascade) | `KpiAssignmentMapper.xml` → `updateAssignmentTargetsMatchingCatalog` |
| GM Unlock → 404 | `unlockGmEvaluationHubAcceptedAssignments` |
| FE không gửi phân bổ khi GM edit | `mapStrategicKpiCreatePayloadToApi.ts` |
| Màu dòng theo creator | `kpi-fe/src/utils/kpiCreatorRowBg.ts` |
| ASM status dictionary | `document/db/init-db.sql` (401–603) |
| Unlock FE 503 OK | `GmKpiEvaluationPanel.vue` → `GM_UNLOCK_DISABLED_STATUS_CODES` (không có 503) |

---

## 10. Quyết định đã chốt (product)

- **Không** checkbox “require re-accept” — luôn bắt buộc với owner assignment.
- **KPI Team:** không ảnh hưởng member cascade đang thực hiện.
- **Giữ điểm** khi về 404; sau confirm **về status cũ** (không 404→405 cho revision).
- **UI:** không đổi background dòng KPI theo creator legend.

---

*Tài liệu này dùng làm checklist triển khai; cập nhật khi API path / tên cột được chốt trong review dev.*
