package com.company.kpi.service.gm;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.UserKpiSummary;
import com.company.kpi.mapper.GmEvaluationHubMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserKpiSummaryMapper;
import com.company.kpi.request.gm.GmEvaluationHubConfirmLine;
import com.company.kpi.request.gm.GmEvaluationHubConfirmRequest;
import com.company.kpi.aggregate.GmEvaluationHubAssignmentRow;
import com.company.kpi.response.gm.GmEvaluationHubAssignmentResponse;
import com.company.kpi.response.gm.GmEvaluationHubConfirmResponse;
import com.company.kpi.response.gm.GmEvaluationHubResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    /**
     * Tab đánh giá GM: toàn bộ assignment trong chu kỳ có {@code status_code} ∈
     * (501, 502, 503, 601, 602, 603) — đồng bộ {@link GmEvaluationHubMapper#listAssignmentsForEvaluationHub}.
     */
    public GmEvaluationHubResponse getEvaluationHub(UUID cycleId) {
        KpiCycle cycle = kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        List<GmEvaluationHubAssignmentRow> rows =
                gmEvaluationHubMapper.listAssignmentsForEvaluationHub(cycleId);

        List<GmEvaluationHubAssignmentResponse> assignments = rows.stream()
                .map(GmEvaluationHubService::toAssignmentResponse)
                .toList();

        GmEvaluationHubResponse out = new GmEvaluationHubResponse();
        out.setCycleId(cycle.getId());
        out.setYear(cycle.getYear());
        out.setCycleName(cycle.getName());
        out.setAssignments(assignments);
        return out;
    }

    /**
     * GM xác nhận drawer: 502→503 (không ghi điểm), 602→603 (ghi {@code end_gm_score});
     * nhận xét supervisor chỉ lưu khi có ít nhất một assignment 602 được cập nhật.
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

        boolean wrote602 = false;
        int updated = 0;
        for (GmEvaluationHubConfirmLine line : byAssignment.values()) {
            UUID aid = line.getAssignmentId();
            Integer st = kpiAssignmentMapper.selectHubConfirmStatus(aid, cycleId, evaluationUserId);
            if (st == null) {
                throw AppException.badRequest(
                        "Assignment không tồn tại hoặc không thuộc nhân viên/chu kỳ: " + aid);
            }
            if (st == 502) {
                int n = kpiAssignmentMapper.updateGmEvaluationHubConfirmReview502(
                        aid, cycleId, evaluationUserId, gmUserId);
                if (n != 1) {
                    throw AppException.badRequest(
                            "Assignment không ở trạng thái chờ review GM (502) hoặc đã xử lý: " + aid);
                }
                updated++;
            } else if (st == 602) {
                BigDecimal score = line.getEndGmScore();
                if (score == null) {
                    throw AppException.badRequest("Thiếu điểm GM (endGmScore) cho assignment cuối kỳ (602): " + aid);
                }
                int n = kpiAssignmentMapper.updateGmEvaluationHubConfirmGrade602(
                        aid, cycleId, evaluationUserId, score, gmUserId);
                if (n != 1) {
                    throw AppException.badRequest(
                            "Assignment không ở trạng thái chờ chấm GM (602) hoặc đã xử lý: " + aid);
                }
                wrote602 = true;
                updated++;
            } else {
                throw AppException.badRequest(
                        "Assignment không ở trạng thái chờ GM (502/602), status=" + st + ": " + aid);
            }
        }

        if (wrote602) {
            String raw = req.getSupervisorComment();
            if (raw == null || raw.isBlank()) {
                throw AppException.badRequest(
                        "Vui lòng nhập nhận xét supervisor khi chấm điểm cuối kỳ (ASM 602).");
            }
            String comment = raw.trim();
            Optional<UserKpiSummary> existing =
                    userKpiSummaryMapper.findByUserIdAndCycleId(evaluationUserId, cycleId);
            if (existing.isPresent()) {
                userKpiSummaryMapper.updateEvaluationSupervisorComments(
                        evaluationUserId, cycleId, comment, gmUserId, gmUserId);
            } else {
                userKpiSummaryMapper.insertEvaluationSupervisorComments(
                        UUID.randomUUID(), evaluationUserId, cycleId, comment, gmUserId, gmUserId, gmUserId);
            }
        }

        GmEvaluationHubConfirmResponse out = new GmEvaluationHubConfirmResponse();
        out.setUpdatedCount(updated);
        out.setSkippedCount(0);
        return out;
    }

    private static GmEvaluationHubAssignmentResponse toAssignmentResponse(GmEvaluationHubAssignmentRow r) {
        GmEvaluationHubAssignmentResponse a = new GmEvaluationHubAssignmentResponse();
        a.setAssignmentId(r.getAssignmentId());
        a.setStatusCode(r.getStatusCode());
        a.setAssignmentStatusName(r.getAssignmentStatusName());
        a.setAssignmentStatusDescription(r.getAssignmentStatusDescription());
        a.setMidSelfScore(r.getMidSelfScore());
        a.setEndSelfScore(r.getEndSelfScore());
        a.setEndPmScore(r.getEndPmScore());
        a.setEndGmScore(r.getEndGmScore());
        a.setEvidences(r.getEvidences());
        a.setTargetDescription(r.getTargetDescription());
        a.setWeight(r.getWeight());
        a.setMasterCode(r.getMasterCode());
        a.setMasterName(r.getMasterName());
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
        return a;
    }
}
