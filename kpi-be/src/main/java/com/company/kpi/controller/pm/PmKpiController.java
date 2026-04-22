package com.company.kpi.controller.pm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.pm.ApproveSheetRequest;
import com.company.kpi.request.pm.PmScoreRequest;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.company.kpi.response.pm.PmKpiDashboardResponse;
import com.company.kpi.service.pm.PmKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * PM KPI endpoints:
 *   GET  /api/v1/kpi/pm/dashboard?year=2025
 *   PUT  /api/v1/kpi/pm/sheet/:memberId/:itemId  { pmScore }
 *   POST /api/v1/kpi/pm/sheet/:memberId/approve  { year }
 */
@RestController
@RequestMapping("/v1/kpi/pm")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('PM', 'GM')")
public class PmKpiController extends BaseController {

    private final PmKpiService pmKpiService;

    @GetMapping("/dashboard")
    public ResponseEntity<BaseResponse<PmKpiDashboardResponse>> getDashboard(
            @RequestParam(required = false) Integer year) {
        return success(pmKpiService.getDashboard(year));
    }

    @PutMapping("/sheet/{memberId}/{itemId}")
    public ResponseEntity<BaseResponse<KpiSheetResponse>> scoreItem(
            @PathVariable UUID memberId,
            @PathVariable UUID itemId,
            @Valid @RequestBody PmScoreRequest request) {
        return success(pmKpiService.scoreItem(memberId, itemId, request));
    }

    @PostMapping("/sheet/{memberId}/approve")
    public ResponseEntity<BaseResponse<Void>> approveSheet(
            @PathVariable UUID memberId,
            @Valid @RequestBody ApproveSheetRequest request) {
        pmKpiService.approveSheet(memberId, request);
        return success(null, "Sheet approved successfully");
    }
}
