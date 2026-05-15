package com.company.kpi.controller.gm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.gm.AddDepartmentMembersRequest;
import com.company.kpi.request.gm.CreateDepartmentRequest;
import com.company.kpi.request.gm.CreateKpiTemplateItemRequest;
import com.company.kpi.request.gm.CreateKpiTemplateRequest;
import com.company.kpi.request.gm.GmApprovedKpiDecisionRequest;
import com.company.kpi.request.gm.GmEvaluationHubConfirmRequest;
import com.company.kpi.request.gm.GmEvaluationHubUnlockRequest;
import com.company.kpi.request.gm.GmPersonalEvaluationSubmitRequest;
import com.company.kpi.request.gm.UpdateDepartmentRequest;
import com.company.kpi.request.gm.UpdateKpiTemplateItemRequest;
import com.company.kpi.request.gm.UpdateKpiTemplateRequest;
import com.company.kpi.request.gm.GmCopyKpisRequest;
import com.company.kpi.response.gm.GmDepartmentMemberCandidateResponse;
import com.company.kpi.response.gm.GmDepartmentResponse;
import com.company.kpi.response.gm.GmDiagnosticsHierarchyResponse;
import com.company.kpi.response.gm.GmApprovedKpiDecisionResponse;
import com.company.kpi.response.gm.GmApprovedKpiQueueItemResponse;
import com.company.kpi.response.gm.GmEvaluationHubConfirmResponse;
import com.company.kpi.response.gm.GmEvaluationHubResponse;
import com.company.kpi.response.gm.GmKpiCategoryResponse;
import com.company.kpi.response.gm.GmKpiCycleOptionResponse;
import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.GmKpiTemplateItemResponse;
import com.company.kpi.response.gm.GmKpiTemplatePackageResponse;
import com.company.kpi.response.gm.GmMemberResponse;
import com.company.kpi.response.gm.GmProcessTimelineResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.service.gm.GmApprovedKpiService;
import com.company.kpi.service.gm.GmDepartmentService;
import com.company.kpi.service.gm.GmEvaluationHubService;
import com.company.kpi.service.gm.GmKpiCategoryService;
import com.company.kpi.service.gm.GmKpiCycleService;
import com.company.kpi.service.gm.GmKpiDiagnosticsHierarchyService;
import com.company.kpi.service.gm.GmKpiService;
import com.company.kpi.service.gm.GmKpiTemplateService;
import com.company.kpi.service.gm.GmProcessTimelineService;
import com.company.kpi.service.member.MemberKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Year;
import java.util.List;
import java.util.UUID;

/**
 * GM KPI endpoints:
 *   GET /api/v1/kpi/gm/dashboard?year=2025
 *   GET /api/v1/kpi/gm/diagnostics-hierarchy?year=2026 — catalog + cây diagnostics trong một payload
 *   GET /api/v1/kpi/gm/kpi-categories — danh sách {@code kpi_categories} (dropdown tạo KPI)
 *   GET /api/v1/kpi/gm/kpi-cycles-with-kpis — chu kỳ {@code kpi_cycles} có KPI (kpis_information / kpi_assignments / user_kpi_summaries)
 *   GET /api/v1/kpi/gm/kpi-cycles-for-evaluation — chu kỳ có dữ liệu KPI (dropdown năm đánh giá / header GM)
 *   GET /api/v1/kpi/gm/evaluation-hub/assignments?cycleId= — tab đánh giá: assignments ASM 501/502/503/601/602/603
 *   POST /api/v1/kpi/gm/evaluation-hub/confirm — GM xác nhận drawer: 502→503, 602→603
 *   GET /api/v1/kpi/gm/approved-kpi-queue?cycleId= — KPI cá nhân ASM 401/402/403
 *   POST /api/v1/kpi/gm/approved-kpi-queue/decision — 403→405/406 hoặc 407→404 (resolve feedback)
 *   GET /api/v1/kpi/gm/sections/:sectionId/members?year=2025
 *   GET /api/v1/kpi/gm/kpi-templates — {@code kpi_templates}
 *   POST /api/v1/kpi/gm/kpi-templates — tạo gói template
 *   PUT /api/v1/kpi/gm/kpi-templates/{templateId} — sửa gói (partial merge)
 *   DELETE /api/v1/kpi/gm/kpi-templates/{templateId} — xóa mềm gói + xóa dòng item; master không còn tham chiếu thì xóa mềm
 *   GET /api/v1/kpi/gm/kpi-templates/{id}/items — {@code kpi_template_items} + master
 *   POST /api/v1/kpi/gm/kpi-templates/{templateId}/items — thêm KPI mẫu ({@code kpi_master} is_global=false + item)
 *   PUT /api/v1/kpi/gm/kpi-templates/{templateId}/items/{itemId} — sửa master + default target/weight
 *   DELETE /api/v1/kpi/gm/kpi-templates/{templateId}/items/{itemId} — xóa dòng item; master orphan thì xóa mềm
 *   GET /api/v1/kpi/gm/departments — danh sách phòng ban (soft-deleted ẩn)
 *   POST /api/v1/kpi/gm/departments — tạo phòng ban (không có mã code; body: name, parentId?, managerId?)
 *   PUT /api/v1/kpi/gm/departments/{departmentId} — cập nhật phòng ban
 *   DELETE /api/v1/kpi/gm/departments/{departmentId} — xóa mềm (chặn nếu còn phòng ban con)
 *   GET /api/v1/kpi/gm/departments/{departmentId}/member-candidates — user chưa thuộc phòng (tìm kiếm / lọc rank)
 *   POST /api/v1/kpi/gm/departments/{departmentId}/members — gán nhiều user vào {@code user_departments}
 *   DELETE /api/v1/kpi/gm/departments/{departmentId}/members/{userId} — gỡ user khỏi phòng
 */
@RestController
@RequestMapping("/v1/kpi/gm")
@RequiredArgsConstructor
@PreAuthorize("hasRole('GM')")
public class GmKpiController extends BaseController {

    private final GmKpiService gmKpiService;
    private final GmKpiDiagnosticsHierarchyService gmKpiDiagnosticsHierarchyService;
    private final GmKpiCategoryService gmKpiCategoryService;
    private final GmKpiCycleService gmKpiCycleService;
    private final GmKpiTemplateService gmKpiTemplateService;
    private final GmDepartmentService gmDepartmentService;
    private final GmEvaluationHubService gmEvaluationHubService;
    private final GmApprovedKpiService gmApprovedKpiService;
    private final GmProcessTimelineService gmProcessTimelineService;
    private final MemberKpiService memberKpiService;

    /** Danh sách phòng ban — {@code departments} (chưa xóa mềm); {@code year} lọc KPI giao cho phòng theo năm chu kỳ. */
    @GetMapping("/departments")
    public ResponseEntity<BaseResponse<List<GmDepartmentResponse>>> listDepartments(
            @RequestParam(name = "year", required = false) Integer year) {
        int y = year != null ? year : Year.now().getValue();
        return success(gmDepartmentService.listDepartments(y));
    }

    /** Tạo phòng ban — không có trường mã code. */
    @PostMapping("/departments")
    public ResponseEntity<BaseResponse<GmDepartmentResponse>> createDepartment(
            @Valid @RequestBody CreateDepartmentRequest request, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return created(gmDepartmentService.create(request, gmUserId));
    }

    @PutMapping("/departments/{departmentId}")
    public ResponseEntity<BaseResponse<GmDepartmentResponse>> updateDepartment(
            @PathVariable UUID departmentId,
            @Valid @RequestBody UpdateDepartmentRequest request,
            Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return success(gmDepartmentService.update(departmentId, request, gmUserId));
    }

    @DeleteMapping("/departments/{departmentId}")
    public ResponseEntity<BaseResponse<Void>> deleteDepartment(
            @PathVariable UUID departmentId, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        gmDepartmentService.delete(departmentId, gmUserId);
        return ResponseEntity.ok(BaseResponse.ok(null, "Department has been deleted."));
    }

    @GetMapping("/departments/{departmentId}/member-candidates")
    public ResponseEntity<BaseResponse<List<GmDepartmentMemberCandidateResponse>>> listDepartmentMemberCandidates(
            @PathVariable UUID departmentId,
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(name = "rankCode", required = false) List<String> rankCodes) {
        return success(gmDepartmentService.listMemberCandidates(departmentId, query, rankCodes));
    }

    @PostMapping("/departments/{departmentId}/members")
    public ResponseEntity<BaseResponse<GmDepartmentResponse>> addDepartmentMembers(
            @PathVariable UUID departmentId, @Valid @RequestBody AddDepartmentMembersRequest request) {
        return success(gmDepartmentService.addMembers(departmentId, request));
    }

    @DeleteMapping("/departments/{departmentId}/members/{userId}")
    public ResponseEntity<BaseResponse<Void>> removeDepartmentMember(
            @PathVariable UUID departmentId, @PathVariable UUID userId) {
        gmDepartmentService.removeMember(departmentId, userId);
        return ResponseEntity.ok(BaseResponse.ok(null, "Member removed from department."));
    }

    @GetMapping("/members")
    public ResponseEntity<BaseResponse<List<GmMemberResponse>>> listMembers() {
        return success(gmDepartmentService.listMembers());
    }

    @DeleteMapping("/members/{userId}")
    public ResponseEntity<BaseResponse<Void>> deleteMember(
            @PathVariable UUID userId, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        gmDepartmentService.deleteMember(userId, gmUserId);
        return ResponseEntity.ok(BaseResponse.ok(null, "Member has been deleted."));
    }

    /** Gói mẫu KPI — {@code kpi_templates}. */
    @GetMapping("/kpi-templates")
    public ResponseEntity<BaseResponse<List<GmKpiTemplatePackageResponse>>> listKpiTemplates() {
        return success(gmKpiTemplateService.listPackages());
    }

    /** KPI trong một gói — {@code kpi_template_items} + {@code kpi_master}. */
    @GetMapping("/kpi-templates/{templateId}/items")
    public ResponseEntity<BaseResponse<List<GmKpiTemplateItemResponse>>> listKpiTemplateItems(
            @PathVariable UUID templateId,
            @RequestParam(name = "year", required = false) Integer year) {
        return success(gmKpiTemplateService.listItems(templateId, year));
    }

    /** Tạo gói mẫu KPI — {@code kpi_templates}. */
    @PostMapping("/kpi-templates")
    public ResponseEntity<BaseResponse<GmKpiTemplatePackageResponse>> createKpiTemplate(
            @Valid @RequestBody CreateKpiTemplateRequest request) {
        return created(gmKpiTemplateService.createTemplate(request));
    }

    /** Cập nhật gói mẫu (trường null trong body = giữ nguyên; {@code job_family_id}/{@code rank_id} không gửi = giữ). */
    @PutMapping("/kpi-templates/{templateId}")
    public ResponseEntity<BaseResponse<GmKpiTemplatePackageResponse>> updateKpiTemplate(
            @PathVariable UUID templateId, @Valid @RequestBody UpdateKpiTemplateRequest request) {
        return success(gmKpiTemplateService.updateTemplate(templateId, request));
    }

    /** Xóa mềm gói + xóa toàn bộ item; {@code kpi_master} chỉ xóa mềm khi không còn kỳ/template dùng. */
    @DeleteMapping("/kpi-templates/{templateId}")
    public ResponseEntity<BaseResponse<Void>> deleteKpiTemplate(
            @PathVariable UUID templateId, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        gmKpiTemplateService.deleteTemplate(templateId, gmUserId);
        return ResponseEntity.ok(BaseResponse.ok(null, "KPI template has been deleted."));
    }

    /**
     * Thêm KPI vào gói mẫu — tách khỏi Strategic KPI: chỉ {@code kpi_master} (is_global=false) +
     * {@code kpi_template_items}, không tạo {@code kpis_information}.
     */
    @PostMapping("/kpi-templates/{templateId}/items")
    public ResponseEntity<BaseResponse<GmKpiTemplateItemResponse>> createKpiTemplateItem(
            @PathVariable UUID templateId,
            @Valid @RequestBody CreateKpiTemplateItemRequest request,
            Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return created(gmKpiTemplateService.createTemplateItem(templateId, request, gmUserId));
    }

    /** Cập nhật KPI trong gói (master + default target/weight). */
    @PutMapping("/kpi-templates/{templateId}/items/{itemId}")
    public ResponseEntity<BaseResponse<GmKpiTemplateItemResponse>> updateKpiTemplateItem(
            @PathVariable UUID templateId,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateKpiTemplateItemRequest request,
            Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return success(gmKpiTemplateService.updateTemplateItem(templateId, itemId, request, gmUserId));
    }

    /** Xóa KPI khỏi gói mẫu (xóa vật lý dòng item); master orphan thì xóa mềm. */
    @DeleteMapping("/kpi-templates/{templateId}/items/{itemId}")
    public ResponseEntity<BaseResponse<Void>> deleteKpiTemplateItem(
            @PathVariable UUID templateId,
            @PathVariable UUID itemId,
            Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        gmKpiTemplateService.deleteTemplateItem(templateId, itemId, gmUserId);
        return ResponseEntity.ok(BaseResponse.ok(null, "KPI template item has been deleted."));
    }

    /**
     * Một API cho GM theo năm: {@code catalogItems} (thư viện KPI) + {@code kpis} (cây phòng ban / assignment).
     */
    @GetMapping("/diagnostics-hierarchy")
    public ResponseEntity<BaseResponse<GmDiagnosticsHierarchyResponse>> getDiagnosticsHierarchy(
            @RequestParam(required = false) Integer year) {
        int y = (year != null) ? year : Year.now().getValue();
        return success(gmKpiDiagnosticsHierarchyService.getHierarchyByYear(y));
    }

    /** Danh sách nhóm KPI ({@code kpi_categories}) — không phụ thuộc năm. */
    @GetMapping("/kpi-categories")
    @PreAuthorize("hasAnyRole('GM','LEADER','PM','MEMBER')")
    public ResponseEntity<BaseResponse<List<GmKpiCategoryResponse>>> listKpiCategories() {
        return success(gmKpiCategoryService.listActiveCategories());
    }

    /** Chu kỳ có dữ liệu KPI trên DB — «Năm nguồn» sao chép nhanh (form GM). */
    @GetMapping("/kpi-cycles-with-kpis")
    @PreAuthorize("hasAnyRole('GM','LEADER','PM','MEMBER')")
    public ResponseEntity<BaseResponse<List<GmKpiCycleOptionResponse>>> listKpiCyclesWithKpis() {
        return success(gmKpiCycleService.listCyclesWithKpisInformation());
    }

    /** Chu kỳ đã có dữ liệu KPI — gồm cả năm trước để GM xem lịch sử đánh giá. */
    @GetMapping("/kpi-cycles-for-evaluation")
    @PreAuthorize("hasAnyRole('GM','LEADER','PM','MEMBER')")
    public ResponseEntity<BaseResponse<List<GmKpiCycleOptionResponse>>> listKpiCyclesForEvaluation() {
        return success(gmKpiCycleService.listCyclesForEvaluationFromCurrentYear());
    }

    /**
     * Hub đánh giá GM: danh sách phẳng {@code kpi_assignments} trong chu kỳ có
     * {@code status_code} ∈ (501, 502, 503, 601, 602, 603).
     */
    @GetMapping("/evaluation-hub/assignments")
    public ResponseEntity<BaseResponse<GmEvaluationHubResponse>> getEvaluationHubAssignments(
            @RequestParam("cycleId") UUID cycleId) {
        return success(gmEvaluationHubService.getEvaluationHub(cycleId));
    }

    /**
     * GM hoàn tất đánh giá drawer: assignment 502→503, 602→603 (chỉ các id thuộc {@code cycleId} và đúng trạng thái).
     */
    @PostMapping("/evaluation-hub/confirm")
    public ResponseEntity<BaseResponse<GmEvaluationHubConfirmResponse>> confirmEvaluationHub(
            @Valid @RequestBody GmEvaluationHubConfirmRequest body, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return success(gmEvaluationHubService.confirmGmEvaluation(body, gmUserId));
    }

    @PostMapping("/evaluation-hub/unlock")
    public ResponseEntity<BaseResponse<GmEvaluationHubConfirmResponse>> unlockEvaluationHubKpis(
            @Valid @RequestBody GmEvaluationHubUnlockRequest body, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return success(gmEvaluationHubService.unlockAcceptedKpis(body, gmUserId));
    }

    /** Tab Approved KPI: assignment cá nhân 401 / 402 / 403. Feedback 407 xử lý ở Strategic diagnostics. */
    @GetMapping("/approved-kpi-queue")
    public ResponseEntity<BaseResponse<List<GmApprovedKpiQueueItemResponse>>> listApprovedKpiQueue(
            @RequestParam("cycleId") UUID cycleId) {
        return success(gmApprovedKpiService.listQueue(cycleId));
    }

    /** GM duyệt/từ chối đề xuất KPI (403) hoặc xử lý feedback chờ GM (407→404). */
    @PostMapping("/approved-kpi-queue/decision")
    public ResponseEntity<BaseResponse<GmApprovedKpiDecisionResponse>> decideApprovedKpi(
            @Valid @RequestBody GmApprovedKpiDecisionRequest body, Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        return success(gmApprovedKpiService.decide(body, gmUserId));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<BaseResponse<GmKpiDashboardResponse>> getDashboard(
            @RequestParam(required = false) Integer year) {
        return success(gmKpiService.getDashboard(year));
    }

    @GetMapping("/sections/{sectionId}/members")
    public ResponseEntity<BaseResponse<List<KpiSectionMemberResponse>>> getSectionMembers(
            @PathVariable UUID sectionId,
            @RequestParam(required = false) Integer year) {
        return success(gmKpiService.getSectionMembers(sectionId, year));
    }

    /**
     * Process Timeline: 3 phases (setting / midYear / yearEnd) với issue buckets.
     * {@code GET /api/v1/kpi/gm/process-timeline?cycleId=}
     */
    @GetMapping("/process-timeline")
    public ResponseEntity<BaseResponse<GmProcessTimelineResponse>> getProcessTimeline(
            @RequestParam("cycleId") UUID cycleId) {
        return success(gmProcessTimelineService.getTimeline(cycleId));
    }

    /**
     * KPI cá nhân (GM): sau khi lưu Actual / điểm từng dòng, GM «Gửi» để khóa đợt —
     * giữa kỳ {@code 405→503}, cuối kỳ {@code 503→603} (theo cửa sổ {@code kpi_cycles}).
     */
    @PostMapping("/personal-evaluation/submit")
    public ResponseEntity<BaseResponse<Void>> submitGmPersonalEvaluation(
            @Valid @RequestBody GmPersonalEvaluationSubmitRequest body, Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        memberKpiService.submitGmPersonalEvaluation(userId, body.getCycleId());
        return success(null);
    }

    /** Lấy danh sách KPI assignment của một member trong chu kỳ (Dùng cho chức năng Copy KPI) */
    @GetMapping("/members/{userId}/kpi-assignments")
    public ResponseEntity<BaseResponse<List<MemberKpiAssignmentDTO>>> getMemberKpiAssignments(
            @PathVariable UUID userId,
            @RequestParam("cycleId") UUID cycleId) {
        return success(gmKpiService.getMemberKpiAssignments(userId, cycleId));
    }

    /** Copy KPI đã chọn sang cho member mới với status_code = 404 */
    @PostMapping("/members/{targetUserId}/copy-kpis")
    public ResponseEntity<BaseResponse<Void>> copyKpisToMember(
            @PathVariable UUID targetUserId,
            @Valid @RequestBody GmCopyKpisRequest request,
            Authentication authentication) {
        UUID gmUserId = UUID.fromString((String) authentication.getPrincipal());
        gmKpiService.copyKpisToMember(targetUserId, request, gmUserId);
        return ResponseEntity.ok(BaseResponse.ok(null, "Successfully copied KPIs to member."));
    }
}
