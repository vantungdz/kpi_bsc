package com.company.kpi.controller.member;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.member.CreateIndividualKpiRequest;
import com.company.kpi.request.member.MemberSheetItemUpdateRequest;
import com.company.kpi.request.member.SaveDraftRequest;
import com.company.kpi.request.member.SubmitEvalRequest;
import com.company.kpi.request.member.SubmitMemberSheetRequest;
import com.company.kpi.response.member.MemberKpiDashboardResponse;
import com.company.kpi.response.member.MemberKpiFormMetaResponse;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.company.kpi.service.member.MemberKpiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Member KPI — alignment {@code document/db/README.md}: Flow 2 (bulk accept trong Submit), Flow 3 (individual KPI),
 * Flow 5 member side (dashboard / sheet / submit).
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

    /** Meta form tạo KPI: {@code kpi_categories} + CALC_RULE (801–804). */
    @GetMapping("/form-meta")
    public ResponseEntity<BaseResponse<MemberKpiFormMetaResponse>> getFormMeta() {
        return success(memberKpiService.getFormMeta());
    }

    @PutMapping("/sheet/{assignmentId}")
    public ResponseEntity<BaseResponse<KpiSheetResponse>> updateSheetItem(
            @PathVariable UUID assignmentId,
            @Valid @RequestBody MemberSheetItemUpdateRequest request,
            Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        return success(memberKpiService.updateSheetItem(assignmentId, userId, request));
    }

    @PostMapping("/evidences/submit")
    public ResponseEntity<BaseResponse<Void>> submitEvidence(
            @Valid @RequestBody SubmitEvalRequest request,
            Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        memberKpiService.submitEvaluation(request, userId);
        return success();
    }

    @PostMapping("/sheet/save-draft")
    public ResponseEntity<BaseResponse<KpiSheetResponse>> saveDraft(
            @Valid @RequestBody SaveDraftRequest request,
            Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        return success(memberKpiService.saveDraft(request, userId));
    }

    @PostMapping("/sheet/submit")
    public ResponseEntity<BaseResponse<Void>> submitSheet(
            @Valid @RequestBody SubmitMemberSheetRequest request,
            Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        memberKpiService.submitMemberSheet(request, userId);
        return success();
    }

    /** README Flow 3: KPI do member đề xuất → ASM 402 */
    @PostMapping("/individual-kpi")
    public ResponseEntity<BaseResponse<Map<String, String>>> createIndividualKpi(
            @Valid @RequestBody CreateIndividualKpiRequest request,
            Authentication authentication) {
        UUID userId = UUID.fromString((String) authentication.getPrincipal());
        UUID assignmentId = memberKpiService.createIndividualKpi(request, userId);
        return created(Map.of("assignmentId", assignmentId.toString()));
    }
}
