package com.company.kpi.controller.kpi;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.kpi.AssignMemberRequest;
import com.company.kpi.request.kpi.CreateStrategicKpiRequest;
import com.company.kpi.response.kpi.StrategicKpiEditResponse;
import com.company.kpi.response.kpi.StrategicKpiResponse;
import com.company.kpi.service.kpi.StrategicKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

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

    /** Tạo KPI chiến lược: {@code kpi_master}, {@code kpis_information}, {@code kpi_assignments}. */
    @PostMapping
    public ResponseEntity<BaseResponse<StrategicKpiResponse>> createStrategicKpi(
            @Valid @RequestBody CreateStrategicKpiRequest request,
            Authentication authentication) {
        UUID actorId = UUID.fromString((String) authentication.getPrincipal());
        return created(strategicKpiService.create(request, actorId));
    }

    /** Dữ liệu form sửa KPI chiến lược. */
    @GetMapping("/{kpiInformationId}")
    public ResponseEntity<BaseResponse<StrategicKpiEditResponse>> getStrategicKpiForEdit(
            @PathVariable UUID kpiInformationId) {
        return success(strategicKpiService.getForEdit(kpiInformationId));
    }

    /** Cập nhật KPI chiến lược + đồng bộ danh sách giao. */
    @PutMapping("/{kpiInformationId}")
    public ResponseEntity<BaseResponse<StrategicKpiResponse>> updateStrategicKpi(
            @PathVariable UUID kpiInformationId,
            @Valid @RequestBody CreateStrategicKpiRequest request,
            Authentication authentication) {
        UUID actorId = UUID.fromString((String) authentication.getPrincipal());
        return success(strategicKpiService.update(kpiInformationId, request, actorId));
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
}
