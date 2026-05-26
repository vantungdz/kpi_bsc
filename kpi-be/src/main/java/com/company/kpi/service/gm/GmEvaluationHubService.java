package com.company.kpi.service.gm;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.common.constant.Constant;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.UserKpiSummary;
import com.company.kpi.mapper.GmEvaluationHubMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserKpiSummaryMapper;
import com.company.kpi.request.gm.GmEvaluationHubConfirmLine;
import com.company.kpi.request.gm.GmEvaluationHubConfirmRequest;
import com.company.kpi.request.gm.GmEvaluationHubUnlockRequest;
import com.company.kpi.aggregate.GmEvaluationHubAssignmentRow;
import com.company.kpi.response.gm.GmEvaluationHubAssignmentResponse;
import com.company.kpi.response.gm.GmEvaluationHubConfirmResponse;
import com.company.kpi.response.gm.GmEvaluationHubResponse;
import com.company.kpi.common.security.SensitiveDataCryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GmEvaluationHubService {
    private final KpiCycleMapper kpiCycleMapper;
    private final GmEvaluationHubMapper gmEvaluationHubMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final UserKpiSummaryMapper userKpiSummaryMapper;
    private final SensitiveDataCryptoService sensitiveDataCryptoService;

    /**
     * Tab đánh giá GM: assignments trong chu kỳ (goal-setting 401–407 và đánh giá 501–504, 601–604) —
     * đồng bộ {@link GmEvaluationHubMapper#listAssignmentsForEvaluationHub}.
     */
    public GmEvaluationHubResponse getEvaluationHub(UUID cycleId) {
        KpiCycle cycle = kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        List<GmEvaluationHubAssignmentRow> rows =
                gmEvaluationHubMapper.listAssignmentsForEvaluationHub(cycleId);

        List<GmEvaluationHubAssignmentResponse> assignments = rows.stream()
                .map(this::toAssignmentResponse)
                .toList();

        GmEvaluationHubResponse out = new GmEvaluationHubResponse();
        out.setCycleId(cycle.getId());
        out.setYear(cycle.getYear());
        out.setCycleName(cycle.getName());
        out.setActivePhase(activePhase(cycle));
        out.setAssignments(assignments);
        return out;
    }

    @Transactional
    public GmEvaluationHubConfirmResponse unlockAcceptedKpis(GmEvaluationHubUnlockRequest req, UUID gmUserId) {
        KpiCycle cycle = kpiCycleMapper.findById(req.getCycleId())
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + req.getCycleId()));
        int updated = kpiAssignmentMapper.unlockGmEvaluationHubAcceptedAssignments(
                req.getCycleId(),
                req.getEvaluationUserId(),
                Boolean.TRUE.equals(req.getPromotion()),
                gmUserId);
        if (updated <= 0) {
            throw AppException.badRequest("Không có KPI phù hợp để mở khóa.");
        }
        GmEvaluationHubConfirmResponse out = new GmEvaluationHubConfirmResponse();
        out.setUpdatedCount(updated);
        out.setSkippedCount(0);
        return out;
    }

    /**
     * GM xác nhận drawer: 501/502→503 (không ghi điểm), 601/602→603 (ghi {@code end_gm_score});
     * cho phép bỏ qua bước PM (501/601). Nhận xét supervisor khi có ít nhất một assignment 601/602.
     */
    @Transactional
    public GmEvaluationHubConfirmResponse confirmGmEvaluation(GmEvaluationHubConfirmRequest req, UUID gmUserId) {
        UUID cycleId = req.getCycleId();
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        UUID evaluationUserId = req.getEvaluationUserId();
        LinkedHashMap<UUID, GmEvaluationHubConfirmLine> byAssignment = new LinkedHashMap<>();
        for (GmEvaluationHubConfirmLine line : req.getLines()) {
            byAssignment.put(line.getAssignmentId(), line);
        }

        boolean wroteYearEndGrade = false;
        int updated = 0;
        for (GmEvaluationHubConfirmLine line : byAssignment.values()) {
            UUID aid = line.getAssignmentId();
            Integer st = kpiAssignmentMapper.selectHubConfirmStatus(aid, cycleId, evaluationUserId);
            if (st == null) {
                throw AppException.badRequest(
                        "Assignment không tồn tại hoặc không thuộc nhân viên/chu kỳ: " + aid);
            }
            if (st == 501) {
                int n = kpiAssignmentMapper.updateGmEvaluationHubConfirmReview501(
                        aid, cycleId, evaluationUserId, gmUserId);
                if (n != 1) {
                    throw AppException.badRequest(
                            "Assignment không ở trạng thái chờ PM/GM giữa năm hoặc đã xử lý: " + aid);
                }
                persistLineGmCommentIfPresent(line, aid, cycleId, evaluationUserId, gmUserId);
                syncCompletedTeamParentFromChildIfReady(aid, cycleId, 501, 503, gmUserId);
                updated++;
            } else if (st == 502) {
                int n = kpiAssignmentMapper.updateGmEvaluationHubConfirmReview502(
                        aid, cycleId, evaluationUserId, gmUserId);
                if (n != 1) {
                    throw AppException.badRequest(
                            "Assignment không ở trạng thái chờ review GM hoặc đã xử lý: " + aid);
                }
                persistLineGmCommentIfPresent(line, aid, cycleId, evaluationUserId, gmUserId);
                syncCompletedTeamParentFromChildIfReady(aid, cycleId, 502, 503, gmUserId);
                updated++;
            } else if (st == 601) {
                BigDecimal score = line.getEndGmScore();
                if (score == null) {
                    throw AppException.badRequest("Thiếu điểm GM cho assignment cuối kỳ: " + aid);
                }
                int n = kpiAssignmentMapper.updateGmEvaluationHubConfirmGrade601(
                        aid, cycleId, evaluationUserId, score, gmUserId);
                if (n != 1) {
                    throw AppException.badRequest(
                            "Assignment không ở trạng thái chờ PM/GM cuối năm hoặc đã xử lý: " + aid);
                }
                persistLineGmCommentIfPresent(line, aid, cycleId, evaluationUserId, gmUserId);
                syncCompletedTeamParentFromChildIfReady(aid, cycleId, 601, 603, gmUserId);
                wroteYearEndGrade = true;
                updated++;
            } else if (st == 602) {
                BigDecimal score = line.getEndGmScore();
                if (score == null) {
                    throw AppException.badRequest("Thiếu điểm GM cho assignment cuối kỳ: " + aid);
                }
                int n = kpiAssignmentMapper.updateGmEvaluationHubConfirmGrade602(
                        aid, cycleId, evaluationUserId, score, gmUserId);
                if (n != 1) {
                    throw AppException.badRequest(
                            "Assignment không ở trạng thái chờ chấm GM hoặc đã xử lý: " + aid);
                }
                persistLineGmCommentIfPresent(line, aid, cycleId, evaluationUserId, gmUserId);
                syncCompletedTeamParentFromChildIfReady(aid, cycleId, 602, 603, gmUserId);
                wroteYearEndGrade = true;
                updated++;
            } else {
                throw AppException.badRequest(
                        "Assignment không ở trạng thái chờ GM/PM đánh giá, status=" + st + ": " + aid);
            }
        }

        String rawSupervisorComment = req.getSupervisorComment();
        boolean shouldPersistSupervisorComment =
                rawSupervisorComment != null && !rawSupervisorComment.isBlank();
        if (wroteYearEndGrade) {
            if (rawSupervisorComment == null || rawSupervisorComment.isBlank()) {
                throw AppException.badRequest(
                        "Please enter a supervisor comment when grading the end of the year.");
            }
            shouldPersistSupervisorComment = true;
        }
        if (shouldPersistSupervisorComment) {
            String comment = rawSupervisorComment.trim();
            Optional<UserKpiSummary> existing =
                    userKpiSummaryMapper.findByUserIdAndCycleId(evaluationUserId, cycleId);
            boolean promotion = Boolean.TRUE.equals(req.getPromotion());
            if (existing.isPresent()) {
                if (promotion) {
                    userKpiSummaryMapper.updateEvaluationSupervisorCommentsPromotion(
                            evaluationUserId, cycleId, comment, gmUserId, gmUserId);
                } else {
                    userKpiSummaryMapper.updateEvaluationSupervisorComments(
                            evaluationUserId, cycleId, comment, gmUserId, gmUserId);
                }
            } else {
                userKpiSummaryMapper.insertEvaluationSupervisorComments(
                        UUID.randomUUID(),
                        evaluationUserId,
                        cycleId,
                        promotion ? null : comment,
                        promotion ? comment : null,
                        gmUserId,
                        gmUserId,
                        gmUserId);
            }
        }

        GmEvaluationHubConfirmResponse out = new GmEvaluationHubConfirmResponse();
        out.setUpdatedCount(updated);
        out.setSkippedCount(0);
        return out;
    }

    private void syncCompletedTeamParentFromChildIfReady(
            UUID childAssignmentId,
            UUID cycleId,
            int waitingStatus,
            int completedStatus,
            UUID gmUserId) {
        kpiAssignmentMapper.syncCompletedTeamParentFromGmConfirmedChild(
                childAssignmentId,
                cycleId,
                waitingStatus,
                completedStatus,
                gmUserId);
    }

    private void persistLineGmCommentIfPresent(
            GmEvaluationHubConfirmLine line,
            UUID assignmentId,
            UUID cycleId,
            UUID evaluationUserId,
            UUID gmUserId) {
        String gmComment = line.getGmComment();
        if (gmComment == null || gmComment.isBlank()) {
            return;
        }
        int commentUpdated = kpiAssignmentMapper.updateGmEvaluationHubLineComment(
                assignmentId, cycleId, evaluationUserId, gmComment.trim(), gmUserId);
        if (commentUpdated != 1) {
            throw AppException.badRequest("Không thể lưu GM comment cho assignment: " + assignmentId);
        }
    }

    private GmEvaluationHubAssignmentResponse toAssignmentResponse(GmEvaluationHubAssignmentRow r) {
        GmEvaluationHubAssignmentResponse a = new GmEvaluationHubAssignmentResponse();
        a.setAssignmentId(r.getAssignmentId());
        a.setStatusCode(r.getStatusCode());
        a.setEvaluationRejectReason(r.getEvaluationRejectReason());
        a.setAssignmentStatusName(r.getAssignmentStatusName());
        a.setAssignmentStatusDescription(r.getAssignmentStatusDescription());
        // Drawer đánh giá GM: luôn trả self score & evidences; bảng Strategic/Diagnostics vẫn lọc ở API riêng.
        a.setMidSelfScore(r.getMidSelfScore());
        a.setEndSelfScore(r.getEndSelfScore());
        a.setEndPmScore(r.getEndPmScore());
        a.setEndGmScore(r.getEndGmScore());
        a.setEvidences(sensitiveDataCryptoService.decryptEvidenceSensitiveFields(r.getEvidences()));
        a.setTargetDescription(r.getTargetDescription());
        a.setTargetValue(r.getTargetValue());
        a.setWeight(r.getWeight());
        a.setMasterCode(r.getMasterCode());
        a.setMasterName(r.getMasterName());
        a.setUnitCode(r.getUnitCode());
        a.setUnitName(r.getUnitName());
        a.setCalculationRuleCode(r.getCalculationRuleCode());
        a.setCalculationTypeCode(r.getCalculationTypeCode());
        a.setCategoryName(r.getCategoryName());
        a.setKpiTypeName(r.getKpiTypeName());
        a.setUserId(r.getUserId());
        a.setUserFullName(r.getUserFullName());
        a.setUserUsername(r.getUserUsername());
        a.setRankCode(r.getRankCode());
        a.setAssigneeSupervisorId(r.getAssigneeSupervisorId());
        a.setAssigneeSupervisorFullName(r.getAssigneeSupervisorFullName());
        a.setSectionId(r.getSectionId());
        a.setSectionName(r.getSectionName());
        a.setSectionManagerId(r.getSectionManagerId());
        a.setSectionManagerFullName(r.getSectionManagerFullName());
        a.setMemberRoleCode(r.getMemberRoleCode());
        a.setMemberRoleName(r.getMemberRoleName());
        a.setEvaluationComments(r.getEvaluationComments());
        a.setEvaluationCommentsPromotion(r.getEvaluationCommentsPromotion());
        a.setSupervisorCommentPortfolio(r.getSupervisorCommentPortfolio());
        a.setSupervisorCommentPromotion(r.getSupervisorCommentPromotion());
        a.setCreatorRoleCode(trimRoleCode(r.getCreatorRoleCode()));
        return a;
    }

    private static String trimRoleCode(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t.toUpperCase();
    }

    private static String activePhase(KpiCycle cycle) {
        OffsetDateTime now = OffsetDateTime.now();
        if (isWithinWindow(now, cycle.getEndYearStart(), cycle.getEndYearEnd())) {
            return Constant.END_YEAR_PHASE;
        }
        if (isWithinWindow(now, cycle.getMidYearStart(), cycle.getMidYearEnd())) {
            return Constant.MID_YEAR_PHASE;
        }
        if (isWithinWindow(now, cycle.getGoalSettingStart(), cycle.getGoalSettingEnd())) {
            return Constant.TARGET_SETUP_PHASE;
        }
        if (cycle.getEndYearEnd() != null && now.isAfter(cycle.getEndYearEnd())) {
            return Constant.END_YEAR_PHASE;
        }
        if (cycle.getMidYearEnd() != null && now.isAfter(cycle.getMidYearEnd())) {
            return Constant.END_YEAR_PHASE;
        }
        if (cycle.getGoalSettingEnd() != null && now.isAfter(cycle.getGoalSettingEnd())) {
            return Constant.MID_YEAR_PHASE;
        }
        return Constant.TARGET_SETUP_PHASE;
    }

    private static boolean isWithinWindow(OffsetDateTime now, OffsetDateTime start, OffsetDateTime end) {
        if (start == null || end == null) {
            return false;
        }
        return !now.isBefore(start) && !now.isAfter(end);
    }
}
