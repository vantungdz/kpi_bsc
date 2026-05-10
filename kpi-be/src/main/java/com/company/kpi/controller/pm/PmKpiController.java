package com.company.kpi.controller.pm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.pm.KpiRegistrationRequest;
import com.company.kpi.request.pm.PmScoreRequest;
import com.company.kpi.response.pm.KpiRegistrationInitResponse;
import com.company.kpi.service.pm.KpiRegistrationService;
import com.company.kpi.service.pm.PmDashboardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/kpi/pm")
@RequiredArgsConstructor
public class PmKpiController extends BaseController {

    private final KpiRegistrationService kpiRegistrationService;
    private final PmDashboardService pmDashboardService;
    private final com.company.kpi.common.util.JwtUtil jwtUtil;

    @GetMapping("/registration/init")
    public ResponseEntity<BaseResponse<KpiRegistrationInitResponse>> getRegistrationInitData(
            Authentication authentication) {
        UUID userId = jwtUtil.resolveUserId(authentication);
        return success(kpiRegistrationService.getInitData(userId));
    }

    @PostMapping("/registration")
    public ResponseEntity<Void> registerKpi(
            @RequestBody KpiRegistrationRequest request,
            Authentication authentication) {
        UUID userId = jwtUtil.resolveUserId(authentication);
        kpiRegistrationService.registerKpi(request, userId);
        return ResponseEntity.ok().build();
    }

    /** PM chấm điểm từng KPI (Team Review) — lưu {@code kpi_assignments.end_pm_score} chỉ khi ASM 601 (cuối kỳ). */
    @PutMapping("/sheet/{memberId}/{assignmentId}")
    public ResponseEntity<BaseResponse<Map<String, Object>>> saveMemberAssignmentPmScore(
            @PathVariable UUID memberId,
            @PathVariable UUID assignmentId,
            @Valid @RequestBody PmScoreRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.savePmEndPmScoreForManagedMember(pmId, memberId, assignmentId, body.getPmScore());
        return success(
                Map.of(
                        "id", assignmentId.toString(),
                        "pmScore", body.getPmScore()));
    }

    @DeleteMapping("/portfolio/{assignmentId}")
    public ResponseEntity<BaseResponse<Void>> deleteSelfCreatedPmKpi(
            @PathVariable UUID assignmentId,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.deleteSelfCreatedPmKpi(assignmentId, pmId);
        return success();
    }
}
