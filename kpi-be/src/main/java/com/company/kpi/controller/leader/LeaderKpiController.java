package com.company.kpi.controller.leader;

import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.leader.LeaderScoreRequest;
import com.company.kpi.response.leader.LeaderKpiInformationResponse;
import com.company.kpi.response.leader.LeaderMemberListResponse;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.company.kpi.response.leader.LeaderKpiDashboardResponse;
import com.company.kpi.service.leader.LeaderKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Leader KPI endpoints:
 *   GET /api/v1/kpi/leader/dashboard?year=2025
 *   PUT /api/v1/kpi/leader/sheet/:memberId/:itemId { leaderScore }
 */
@RestController
@RequestMapping("/v1/kpi/leader")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('LEADER', 'PM', 'GM')")
public class LeaderKpiController extends BaseController {

    private final LeaderKpiService leaderKpiService;

    @GetMapping("/kpi-info")
    public ResponseEntity<BaseResponse<LeaderKpiInformationResponse>> getKpiInfo(
            @RequestParam Integer year, @RequestParam(defaultValue = "INDIVIDUAL") Constant.KpiType type,
            @RequestParam(required = false) UUID userId,
            Authentication authentication) {
        UUID currentUserId = UUID.fromString((String) authentication.getPrincipal());
        UUID targetUserId = userId != null ? userId : currentUserId;
        return success(leaderKpiService.getKpiInfo(year, type, targetUserId));
    }

    @GetMapping("/members")
    public ResponseEntity<BaseResponse<LeaderMemberListResponse>> getMemberList(Authentication authentication) {
        return success(leaderKpiService.getMemberList(UUID.fromString((String) authentication.getPrincipal())));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<BaseResponse<LeaderKpiDashboardResponse>> getDashboard(
            @RequestParam(required = false) Integer year) {
        return success(leaderKpiService.getDashboard(year));
    }

    @PutMapping("/sheet/{memberId}/{itemId}")
    public ResponseEntity<BaseResponse<KpiSheetResponse>> scoreItem(
            @PathVariable UUID memberId,
            @PathVariable UUID itemId,
            @Valid @RequestBody LeaderScoreRequest request) {
        return success(leaderKpiService.scoreItem(memberId, itemId, request));
    }
}
