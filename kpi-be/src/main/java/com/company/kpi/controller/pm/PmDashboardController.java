package com.company.kpi.controller.pm;

import com.company.kpi.response.pm.MemberKpiDetailResponse;
import com.company.kpi.response.pm.PmDashboardResponse;
import com.company.kpi.response.pm.TeamMemberResponse;
import com.company.kpi.service.pm.PmDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import com.company.kpi.common.util.JwtUtil;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.common.dto.BaseResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/pm/dashboard")
@RequiredArgsConstructor
public class PmDashboardController extends BaseController {

    private final PmDashboardService pmDashboardService;
    private final JwtUtil jwtUtil;

    @GetMapping("/init")
    public ResponseEntity<BaseResponse<PmDashboardResponse>> initDashboard(
            @RequestParam("year") Integer year,
            Authentication authentication
    ) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        PmDashboardResponse response = pmDashboardService.getDashboardInitialization(pmId, year);
        return success(response);
    }

    @GetMapping("/team-members")
    public ResponseEntity<BaseResponse<List<TeamMemberResponse>>> getTeamHierarchy(
            @RequestParam Integer year,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        return success(pmDashboardService.getTeamHierarchy(pmId, year));
    }

    @GetMapping("/team-members/{memberId}/kpis")
    public ResponseEntity<BaseResponse<List<MemberKpiDetailResponse>>> getMemberKpiDetails(
            @PathVariable UUID memberId,
            @RequestParam Integer year) {
        return success(pmDashboardService.getMemberKpiDetails(memberId, year));
    }
}