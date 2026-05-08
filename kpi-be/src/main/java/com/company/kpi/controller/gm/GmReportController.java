package com.company.kpi.controller.gm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.response.gm.report.GmReportComplianceResponse;
import com.company.kpi.response.gm.report.GmReportLevelDistributionResponse;
import com.company.kpi.response.gm.report.GmReportSectionAnalyticsResponse;
import com.company.kpi.response.gm.report.GmReportSectionBellCurveResponse;
import com.company.kpi.service.gm.GmReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.List;

/**
 * GM Reports endpoints — phục vụ trang "Trung tâm Báo cáo Chuyên sâu".
 *
 *   GET /api/v1/kpi/gm/reports/score-distribution
 *   GET /api/v1/kpi/gm/reports/section-bell-curve
 *   GET /api/v1/kpi/gm/reports/section-analytics
 *   GET /api/v1/kpi/gm/reports/compliance
 */
@RestController
@RequestMapping("/v1/kpi/gm/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('GM')")
public class GmReportController extends BaseController {

    private final GmReportService gmReportService;

    @GetMapping("/score-distribution")
    public ResponseEntity<BaseResponse<GmReportLevelDistributionResponse>> getLevelDistribution(
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "compareYears", required = false) List<Integer> compareYears,
            @RequestParam(name = "sectionId", required = false) String sectionId) {
        int y = year != null ? year : Year.now().getValue();
        return success(gmReportService.getLevelDistribution(y, compareYears, sectionId));
    }

    @GetMapping("/section-bell-curve")
    public ResponseEntity<BaseResponse<GmReportSectionBellCurveResponse>> getSectionBellCurve(
            @RequestParam(name = "year", required = false) Integer year) {
        int y = year != null ? year : Year.now().getValue();
        return success(gmReportService.getSectionBellCurve(y));
    }

    @GetMapping("/section-analytics")
    public ResponseEntity<BaseResponse<GmReportSectionAnalyticsResponse>> getSectionAnalytics(
            @RequestParam(name = "year", required = false) Integer year) {
        int y = year != null ? year : Year.now().getValue();
        return success(gmReportService.getSectionAnalytics(y));
    }

    @GetMapping("/compliance")
    public ResponseEntity<BaseResponse<GmReportComplianceResponse>> getCompliance(
            @RequestParam(name = "year", required = false) Integer year) {
        int y = year != null ? year : Year.now().getValue();
        return success(gmReportService.getCompliance(y));
    }
}
