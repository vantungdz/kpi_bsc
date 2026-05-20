package com.company.kpi.controller.kpi;

import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.common.util.JwtUtil;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.kpi.AssignMemberRequest;
import com.company.kpi.request.kpi.CreateStrategicKpiRequest;
import com.company.kpi.request.kpi.UpdateKpiStatusRequest;
import com.company.kpi.response.kpi.StrategicKpiEditResponse;
import com.company.kpi.response.kpi.StrategicKpiResponse;
import com.company.kpi.service.kpi.StrategicKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Strategic KPI CRUD — dùng chung cho GM và PM.
 *   POST   /api/v1/kpi/strategic-kpis
 *   GET    /api/v1/kpi/strategic-kpis/{kpiInformationId}
 *   PUT    /api/v1/kpi/strategic-kpis/{kpiInformationId}
 *   DELETE /api/v1/kpi/strategic-kpis/{kpiInformationId}
 */
@RestController
@RequestMapping("/v1/kpi/strategic-kpis")
@RequiredArgsConstructor
public class StrategicKpiController extends BaseController {

    private final StrategicKpiService strategicKpiService;
    private final JwtUtil jwtUtil;

    /** Tạo KPI chiến lược: {@code kpi_master}, {@code kpis_information}, {@code kpi_assignments}. */
    @PostMapping
    public ResponseEntity<BaseResponse<StrategicKpiResponse>> createStrategicKpi(
            @Valid @RequestBody CreateStrategicKpiRequest request,
            Authentication authentication) {
        UUID actorId = UUID.fromString((String) authentication.getPrincipal());
        return created(strategicKpiService.create(request, actorId, resolveStrategicActorRole(authentication)));
    }

    /**
     * Dữ liệu form sửa KPI chiến lược.
     *
     * @param parentAssignmentId optional — khi PM tải form phân bổ: chỉ trả member/target thuộc cascade dưới
     *                           đúng {@code kpi_assignments.id} của PM (tránh lẫn danh sách PM do GM giao).
     */
    @GetMapping("/{kpiInformationId}")
    public ResponseEntity<BaseResponse<StrategicKpiEditResponse>> getStrategicKpiForEdit(
            @PathVariable UUID kpiInformationId,
            @RequestParam(required = false) UUID parentAssignmentId,
            Authentication authentication) {
        UUID actorId = UUID.fromString((String) authentication.getPrincipal());
        return success(strategicKpiService.getForEdit(kpiInformationId, actorId, parentAssignmentId));
    }

    /** Cập nhật KPI chiến lược + đồng bộ danh sách giao. */
    @PutMapping("/{kpiInformationId}")
    public ResponseEntity<BaseResponse<StrategicKpiResponse>> updateStrategicKpi(
            @PathVariable UUID kpiInformationId,
            @Valid @RequestBody CreateStrategicKpiRequest request,
            Authentication authentication) {
        UUID actorId = UUID.fromString((String) authentication.getPrincipal());
        return success(
                strategicKpiService.update(kpiInformationId, request, actorId, resolveStrategicActorRole(authentication)));
    }

    /**
     * Member/Leader (KPI individual): 402.
     * PM / GM và các role khác: 404 (PM gửi GM qua bulk 404→403 khi goal setting).
     */
    private static String resolveStrategicActorRole(Authentication authentication) {
        Set<String> authorities =
                authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .map(r -> r.replace("ROLE_", ""))
                        .collect(Collectors.toSet());
        if (authorities.contains(Constant.ROLE_MEMBER)) {
            return Constant.ROLE_MEMBER;
        }
        if (authorities.contains(Constant.ROLE_LEADER)) {
            return Constant.ROLE_LEADER;
        }
        if (authorities.contains(Constant.ROLE_PM)) {
            return Constant.ROLE_PM;
        }
        return "";
    }

    /**
     * Xóa mềm KPI chiến lược theo {@code kpis_information.id}: toàn bộ {@code kpi_assignments} cùng kỳ,
     * bản {@code kpis_information}, và {@code kpi_master} nếu không còn kỳ nào active.
     */
    @DeleteMapping("/{kpiInformationId}")
    public ResponseEntity<BaseResponse<Void>> deleteStrategicKpi(
            @PathVariable UUID kpiInformationId,
            Authentication authentication) {
        UUID actorId = UUID.fromString((String) authentication.getPrincipal());
        strategicKpiService.deleteByKpiInformationId(kpiInformationId, actorId);
        return ResponseEntity.ok(
                BaseResponse.ok(null, "Strategic KPI and related assignments have been deleted."));
    }

    /**
     * API to cascade a strategic KPI to all members . This will create corresponding {@code kpi_assignments}
     * @param request
     * @param authentication
     * @return
     */
    @PostMapping("/cascade")
    public ResponseEntity<BaseResponse<Void>> cascadeKpiToMembers(
            @Valid @RequestBody AssignMemberRequest request,
            Authentication authentication) {
        UUID pmId = UUID.fromString((String) authentication.getPrincipal());
        strategicKpiService.assignToMembers(request, pmId);
        return success(null, "KPI has been cascaded to all members successfully.");
    }

    /**
     * API to update the status of all KPIs for the current user (bulk update).
     */
    @PutMapping("/status/bulk-update")
    public ResponseEntity<BaseResponse<Integer>> bulkUpdateKpiStatus(
            @Valid @RequestBody UpdateKpiStatusRequest request,
            Authentication authentication) {
            
        UUID currentUserId = jwtUtil.resolveUserId(authentication);

        int updatedCount = strategicKpiService.updateStatusesKpi(request, currentUserId);

        return success(updatedCount,  "Update status successfully.");
    }
}
