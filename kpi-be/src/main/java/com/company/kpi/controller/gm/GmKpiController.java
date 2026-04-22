package com.company.kpi.controller.gm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import com.company.kpi.service.gm.GmKpiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * GM KPI endpoints:
 *   GET /api/v1/kpi/gm/dashboard?year=2025
 *   GET /api/v1/kpi/gm/sections/:sectionId/members?year=2025
 */
@RestController
@RequestMapping("/v1/kpi/gm")
@RequiredArgsConstructor
@PreAuthorize("hasRole('GM')")
public class GmKpiController extends BaseController {

    private final GmKpiService gmKpiService;

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
}
