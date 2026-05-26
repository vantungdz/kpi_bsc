package com.company.kpi.controller.pm;

import com.company.kpi.request.pm.PmMemberKpiApprovalDecisionRequest;
import com.company.kpi.request.pm.PmAcceptMemberFeedbackWithCascadeRequest;
import com.company.kpi.request.pm.PmMemberFeedbackDecisionRequest;
import com.company.kpi.request.pm.PmGmFeedbackRequest;
import com.company.kpi.request.pm.PmKpiCommentRequest;
import com.company.kpi.request.pm.PmSupervisorCommentRequest;
import com.company.kpi.response.gm.GmProcessTimelineResponse;
import com.company.kpi.response.gm.GmPromotionCycleOptionResponse;
import com.company.kpi.response.gm.GmPromotionProcessTimelineResponse;
import com.company.kpi.service.gm.GmKpiService;
import com.company.kpi.response.pm.MemberKpiDetailResponse;
import com.company.kpi.response.pm.PmDashboardResponse;
import com.company.kpi.response.pm.PmMemberKpiApprovalItemResponse;
import com.company.kpi.response.pm.PmMemberReviewMetaResponse;
import com.company.kpi.response.pm.TeamMemberResponse;
import com.company.kpi.request.evaluation.EvaluationRejectRequest;
import com.company.kpi.response.evaluation.EvaluationRejectResponse;
import com.company.kpi.service.kpi.EvaluationRejectService;
import com.company.kpi.service.pm.PmDashboardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import com.company.kpi.common.util.JwtUtil;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.common.dto.BaseResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final GmKpiService gmKpiService;
    private final EvaluationRejectService evaluationRejectService;
    private final JwtUtil jwtUtil;

    @GetMapping("/init")
    public ResponseEntity<BaseResponse<PmDashboardResponse>> initDashboard(
            @RequestParam("year") Integer year,
            @RequestParam(value = "scope", required = false) String scope,
            Authentication authentication
    ) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        PmDashboardResponse response = pmDashboardService.getDashboardInitialization(pmId, year, scope);
        return success(response);
    }

    /** Process timeline (Setting / Mid-year / Year-end) — chỉ phòng do PM đăng nhập quản lý. */
    @GetMapping("/process-timeline")
    public ResponseEntity<BaseResponse<GmProcessTimelineResponse>> getProcessTimeline(
            @RequestParam Integer year,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        return success(pmDashboardService.getProcessTimelineForPm(pmId, year));
    }

    /** Promotion process timeline — chỉ phòng do PM đăng nhập quản lý. */
    @GetMapping("/promotion-process-timeline")
    public ResponseEntity<BaseResponse<GmPromotionProcessTimelineResponse>> getPromotionProcessTimeline(
            @RequestParam("promotionCycleId") UUID promotionCycleId,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        return success(pmDashboardService.getPromotionProcessTimelineForPm(pmId, promotionCycleId));
    }

    /** Promotion cycles for PM header dropdown — cùng nguồn {@code promotion_cycles} như GM. */
    @GetMapping("/promotion-cycles")
    public ResponseEntity<BaseResponse<List<GmPromotionCycleOptionResponse>>> listPromotionCycles(
            @RequestParam(value = "year", required = false) Integer year) {
        int y = year != null ? year : java.time.LocalDate.now().getYear();
        return success(gmKpiService.listPromotionCycles(y));
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

    /** Nhận xét tổng member/PM (portfolio vs promotion) cho drawer Team Review. */
    @GetMapping("/team-members/{memberId}/review-meta")
    public ResponseEntity<BaseResponse<PmMemberReviewMetaResponse>> getMemberReviewMeta(
            @PathVariable UUID memberId,
            @RequestParam Integer year,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        return success(pmDashboardService.getMemberReviewMeta(pmId, memberId, year));
    }

    /** Tab Request Approval: đề xuất KPI cá nhân (402) — member có supervisor = PM đăng nhập. */
    @GetMapping("/member-kpi-approvals")
    public ResponseEntity<BaseResponse<List<PmMemberKpiApprovalItemResponse>>> listMemberKpiApprovals(
            @RequestParam Integer year,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        return success(pmDashboardService.listPendingMemberKpiApprovals(pmId, year));
    }

    /** PM duyệt (403) hoặc từ chối (406). */
    @PostMapping("/member-kpi-approvals/decision")
    public ResponseEntity<BaseResponse<Void>> decideMemberKpiApproval(
            @Valid @RequestBody PmMemberKpiApprovalDecisionRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.decideMemberKpiApproval(pmId, body);
        return success();
    }

    /** PM gửi feedback KPI được GM giao: 404→407 (chờ GM xử lý). */
    @PostMapping("/gm-feedback")
    public ResponseEntity<BaseResponse<Void>> submitFeedbackToGm(
            @Valid @RequestBody PmGmFeedbackRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.submitFeedbackToGm(pmId, body);
        return success();
    }

    /** PM xử lý feedback member: 407→404 (duyệt / từ chối đều đóng feedback). */
    @PostMapping("/member-feedbacks/decision")
    public ResponseEntity<BaseResponse<Void>> decideMemberFeedback(
            @Valid @RequestBody PmMemberFeedbackDecisionRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.decideMemberFeedback(pmId, body);
        return success();
    }

    /** PM chấp nhận feedback + lưu phân bổ KPI Team trong một transaction (sau khi chỉnh drawer phân bổ). */
    @PostMapping("/member-feedbacks/accept-with-cascade")
    public ResponseEntity<BaseResponse<Void>> acceptMemberFeedbackWithCascade(
            @Valid @RequestBody PmAcceptMemberFeedbackWithCascadeRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.acceptMemberFeedbackWithCascade(pmId, body);
        return success();
    }

    /** PM saves comment for individual KPI during Team Review evaluation. */
    @PostMapping("/member-kpi-comment")
    public ResponseEntity<BaseResponse<Void>> saveMemberKpiComment(
            @Valid @RequestBody PmKpiCommentRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.savePmKpiComment(pmId, body.getYear(), body.getAssignmentId(), body.getPmComment());
        return success();
    }

    /** PM lưu nhận xét tổng của member để hiển thị Team Review/GM hub. */
    @PostMapping("/member-supervisor-comment")
    public ResponseEntity<BaseResponse<Void>> saveMemberSupervisorComment(
            @Valid @RequestBody PmSupervisorCommentRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        pmDashboardService.savePmSupervisorComment(pmId, body.getYear(), body.getMemberId(), body.getPmComment(), body.getPromotion());
        return success();
    }

    /** PM từ chối đánh giá trong drawer Team Review (501/502→504 + siblings→405; 601/602→604 + siblings→503). */
    @PostMapping("/team-members/{memberId}/evaluation/reject")
    public ResponseEntity<BaseResponse<EvaluationRejectResponse>> rejectMemberEvaluation(
            @PathVariable UUID memberId,
            @Valid @RequestBody EvaluationRejectRequest body,
            Authentication authentication) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        body.setEvaluationUserId(memberId);
        return success(evaluationRejectService.rejectForPm(body, pmId));
    }
}
