package com.company.kpi.controller.member;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.member.SaveDraftRequest;
import com.company.kpi.request.member.SelfScoreRequest;
import com.company.kpi.request.member.SubmitEvalRequest;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.company.kpi.response.member.MemberKpiDashboardResponse;
import com.company.kpi.service.member.MemberKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Member KPI endpoints:
 *   GET  /api/v1/kpi/member/dashboard?year=2025
 *   PUT  /api/v1/kpi/member/sheet/:itemId  { selfScore }
 *   POST /api/v1/kpi/member/sheet/submit   { year }
 *   POST /api/v1/kpi/member/sheet/save-draft { year }
 */
@RestController
@RequestMapping("/v1/kpi/member")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MEMBER', 'LEADER', 'PM', 'GM')")
public class MemberKpiController extends BaseController {

    private final MemberKpiService memberKpiService;

    @GetMapping("/dashboard")
    public ResponseEntity<BaseResponse<MemberKpiDashboardResponse>> getDashboard(
            @RequestParam(required = false) Integer year, Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        return success(memberKpiService.getDashboard(year, userId));
    }

    @PutMapping("/kpi")
    public ResponseEntity<BaseResponse<KpiSheetResponse>> updateSelfScore(
            @PathVariable UUID itemId,
            @Valid @RequestBody SelfScoreRequest request) {
        return success(memberKpiService.updateSelfScore(itemId, request));
    }

    @PostMapping("/evidences/submit")
    public ResponseEntity<BaseResponse<Void>> submitEvaluation(
            @Valid @RequestBody SubmitEvalRequest request) {
        memberKpiService.submitEvaluation(request);
        return success();
    }

    @PostMapping("/sheet/save-draft")
    public ResponseEntity<BaseResponse<KpiSheetResponse>> saveDraft(
            @Valid @RequestBody SaveDraftRequest request) {
        return success(memberKpiService.saveDraft(request));
    }
}
