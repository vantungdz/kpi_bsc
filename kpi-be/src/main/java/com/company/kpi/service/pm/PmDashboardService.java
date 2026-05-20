package com.company.kpi.service.pm;

import com.company.kpi.aggregate.KpiAssignmentDetailAggregate;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.aggregate.PmPortfolioCascadeChildRow;
import com.company.kpi.aggregate.UserTeamHierarchyAggregate;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.KpiMasterMapper;
import com.company.kpi.mapper.KpisInformationMapper;
import com.company.kpi.mapper.SysStatusCodeMapper;
import com.company.kpi.mapper.UserKpiSummaryMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.pm.PmAcceptMemberFeedbackWithCascadeRequest;
import com.company.kpi.request.pm.PmMemberKpiApprovalDecisionRequest;
import com.company.kpi.request.pm.PmMemberFeedbackDecisionRequest;
import com.company.kpi.request.pm.PmGmFeedbackRequest;
import com.company.kpi.response.common.KpiCycleResponse;
import com.company.kpi.response.pm.MemberKpiDetailResponse;
import com.company.kpi.response.gm.GmProcessTimelineResponse;
import com.company.kpi.response.pm.PmDashboardResponse;
import com.company.kpi.response.pm.PmMemberKpiApprovalItemResponse;
import com.company.kpi.response.pm.PmMemberReviewMetaResponse;
import com.company.kpi.response.pm.PmPortfolioGatePendingMemberResponse;
import com.company.kpi.response.pm.PmPortfolioGateResponse;
import com.company.kpi.response.pm.TeamMemberResponse;
import com.company.kpi.service.gm.GmProcessTimelineService;
import com.company.kpi.service.kpi.StrategicKpiService;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.entity.KpisInformation;
import com.company.kpi.entity.SysStatusCode;
import com.company.kpi.entity.UserKpiSummary;

@Service
@RequiredArgsConstructor
public class PmDashboardService {

    private static final ObjectMapper PM_DASHBOARD_JSON = new ObjectMapper();

    private static String trimUpperOrNull(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t.toUpperCase();
    }

    /**
     * Cột Supervisor Score (PM dashboard): sau khi GM chấm thì hiển thị {@code end_gm_score},
     * trước đó vẫn dùng {@code end_pm_score}.
     */
    private static BigDecimal supervisorPortfolioScore(KpiAssignment a) {
        if (a == null) {
            return null;
        }
        if (a.getEndGmScore() != null) {
            return a.getEndGmScore();
        }
        return a.getEndPmScore();
    }

    private static BigDecimal supervisorPortfolioScoreForPmNode(
            KpiAssignment parentAssignment,
            List<PmPortfolioCascadeChildRow> children,
            UUID pmId,
            Integer typeCode) {
        if (Objects.equals(typeCode, 102) && children != null && pmId != null) {
            for (PmPortfolioCascadeChildRow child : children) {
                if (child == null || child.getChildUser() == null || child.getChildAssignment() == null) {
                    continue;
                }
                if (pmId.equals(child.getChildUser().getId())) {
                    return supervisorPortfolioScore(child.getChildAssignment());
                }
            }
        }
        return supervisorPortfolioScore(parentAssignment);
    }

    private static boolean isPromotionKpi(KpiAssignmentDetailAggregate detail) {
        return detail != null
                && detail.getKpiMaster() != null
                && Objects.equals(detail.getKpiMaster().getTypeCode(), 103);
    }

    private static BigDecimal effectiveSelfScore(KpiAssignmentDetailAggregate detail) {
        if (detail == null) {
            return null;
        }
        return detail.getEndSelfScore() != null ? detail.getEndSelfScore() : detail.getMidSelfScore();
    }

    private static BigDecimal averageMemberScore(
            List<KpiAssignmentDetailAggregate> details,
            boolean promotion,
            boolean supervisorScore) {
        if (details == null || details.isEmpty()) {
            return null;
        }
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (KpiAssignmentDetailAggregate detail : details) {
            if (isPromotionKpi(detail) != promotion) {
                continue;
            }
            BigDecimal score = supervisorScore ? supervisorPortfolioScore(detail) : effectiveSelfScore(detail);
            if (score == null) {
                continue;
            }
            sum = sum.add(score);
            count++;
        }
        return count == 0 ? null : sum.divide(BigDecimal.valueOf(count), 6, RoundingMode.HALF_UP);
    }

    private static BigDecimal averageAllMemberScore(
            List<KpiAssignmentDetailAggregate> details,
            boolean supervisorScore) {
        if (details == null || details.isEmpty()) {
            return null;
        }
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (KpiAssignmentDetailAggregate detail : details) {
            BigDecimal score = supervisorScore ? supervisorPortfolioScore(detail) : effectiveSelfScore(detail);
            if (score == null) {
                continue;
            }
            sum = sum.add(score);
            count++;
        }
        return count == 0 ? null : sum.divide(BigDecimal.valueOf(count), 6, RoundingMode.HALF_UP);
    }

    private static Integer effectiveMemberStatus(List<KpiAssignmentDetailAggregate> details, Boolean promotion) {
        if (details == null || details.isEmpty()) {
            return null;
        }
        List<Integer> statuses = details.stream()
                .filter(detail -> promotion == null || isPromotionKpi(detail) == promotion)
                .map(KpiAssignmentDetailAggregate::getStatusCode)
                .filter(Objects::nonNull)
                .toList();
        if (statuses.isEmpty()) {
            return null;
        }
        int[] priority = {602, 601, 502, 501, 404, 405, 503, 603};
        for (int code : priority) {
            if (statuses.contains(code)) {
                return code;
            }
        }
        return statuses.stream().min(Integer::compareTo).orElse(null);
    }

    /** Trích {@code gmComment} từ JSON evidences assignment (GM đánh giá cuối kỳ). */
    private static String gmCommentFromEvidencesJson(String evidences) {
        if (evidences == null) {
            return null;
        }
        String trimmed = evidences.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            JsonNode root = PM_DASHBOARD_JSON.readTree(trimmed);
            if (root == null || !root.has("gmComment") || root.get("gmComment").isNull()) {
                return null;
            }
            String c = root.get("gmComment").asText("").trim();
            return c.isEmpty() ? null : c;
        } catch (Exception ignored) {
            return null;
        }
    }

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiMasterMapper kpiMasterMapper;
    private final SysStatusCodeMapper sysStatusCodeMapper;
    private final UserMapper userMapper;
    private final UserKpiSummaryMapper userKpiSummaryMapper;
    private final GmProcessTimelineService gmProcessTimelineService;
    private final StrategicKpiService strategicKpiService;

    public GmProcessTimelineResponse getProcessTimelineForPm(UUID pmId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        return gmProcessTimelineService.getTimelineForPm(cycleOpt.get().getId(), pmId);
    }

    public PmDashboardResponse getDashboardInitialization(UUID pmId, Integer year) {
        
        // lấy cycle id từ mapper (sử dụng findByYear hiện có)
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }

        UUID cycleId = cycleOpt.get().getId();
        UserKpiSummary summary = userKpiSummaryMapper.findByUserIdAndCycleId(pmId, cycleId).orElse(null);

        List<PmDashboardAggregate> aggregates = kpiAssignmentMapper.findPmPortfolioByPmIdAndCycleId(pmId, cycleId);

        List<SysStatusCode> asmStatuses =
                sysStatusCodeMapper.findByCategories(Arrays.asList("ASM_STATUS"));

        // Map dùng PM_Assignment_ID làm key
        Map<UUID, PmDashboardResponse.KpiGroupDto> kpiGroupMap = new LinkedHashMap<>();

        for (PmDashboardAggregate agg : aggregates) {
            if (agg.getPmAssignment() == null || agg.getPmAssignment().getId() == null) continue;
            UUID pmAsmId = agg.getPmAssignment().getId();

            PmDashboardResponse.KpiGroupDto groupDto = kpiGroupMap.computeIfAbsent(pmAsmId, id -> {
                BigDecimal pmSelfScore = agg.getPmAssignment().getEndSelfScore() != null
                        ? agg.getPmAssignment().getEndSelfScore()
                        : agg.getPmAssignment().getMidSelfScore();

                return PmDashboardResponse.KpiGroupDto.builder()
                        .id(pmAsmId)
                        .infoId(agg.getKpiInfo() != null ? agg.getKpiInfo().getId() : null)
                        .group(agg.getKpiCategory() != null ? agg.getKpiCategory().getName() : null)
                        .code(agg.getKpiMaster() != null ? agg.getKpiMaster().getCode() : null)
                        .name(agg.getKpiMaster() != null ? agg.getKpiMaster().getName() : null)
                        .kpiType(agg.getKpiMaster() != null ? agg.getKpiMaster().getTypeCode() : null)
                        .calculationRuleCode(agg.getKpiMaster() != null ? agg.getKpiMaster().getCalculationRuleCode() : null)
                        .calculationTypeCode(agg.getKpiMaster() != null ? agg.getKpiMaster().getCalculationTypeCode() : null)
                        .unitCode(agg.getKpiMaster() != null ? agg.getKpiMaster().getUnitCode() : null)
                        .isImportant(agg.getKpiInfo() != null ? agg.getKpiInfo().getIsImportant() : null)
                        .target(resolvePmPortfolioTargetDisplay(agg.getPmAssignment(), agg.getKpiInfo()))
                        .targetDescriptionJson(
                                agg.getKpiInfo() != null ? agg.getKpiInfo().getTargetDescription() : null)
                        .weight(agg.getKpiInfo() != null ? agg.getKpiInfo().getWeight() : null)
                        .statusCode(agg.getPmAssignment() != null ? agg.getPmAssignment().getStatusCode() : null)
                        .updateReason(agg.getPmAssignment() != null ? agg.getPmAssignment().getUpdateReason() : null)
                        .actualResult(agg.getPmAssignment().getEvidences())
                        .feedbackNote(agg.getPmFeedbackNote())
                        .selfScore(pmSelfScore)
                        .pmScore(supervisorPortfolioScoreForPmNode(
                                agg.getPmAssignment(),
                                agg.getCascadeChildren(),
                                pmId,
                                agg.getKpiMaster() != null ? agg.getKpiMaster().getTypeCode() : null))
                        .gmEvaluationComment(gmCommentFromEvidencesJson(agg.getPmAssignment().getEvidences()))
                        .isTree(agg.getKpiMaster() != null && agg.getKpiMaster().getTypeCode() != null && agg.getKpiMaster().getTypeCode() == 102)
                        .expanded(true)
                        .isSelfCreated(pmId.equals(agg.getPmAssignment().getCreatedBy()))
                        .creatorRoleCode(trimUpperOrNull(agg.getKpiCreatorRoleCode()))
                        .build();
            });

            if (agg.getCascadeChildren() != null) {
                for (PmPortfolioCascadeChildRow slice : agg.getCascadeChildren()) {
                    if (slice.getChildAssignment() == null || slice.getChildAssignment().getId() == null) {
                        continue;
                    }
                    BigDecimal childSelfScore = slice.getChildAssignment().getEndSelfScore() != null
                            ? slice.getChildAssignment().getEndSelfScore()
                            : slice.getChildAssignment().getMidSelfScore();

                    groupDto.getChildren().add(PmDashboardResponse.KpiChildDto.builder()
                            .id(slice.getChildAssignment().getId())
                            .userId(slice.getChildUser() != null ? slice.getChildUser().getId() : null)
                            .name(slice.getChildUser() != null ? slice.getChildUser().getFullName() : "Unknown")
                            .role(slice.getChildJobTitle() != null ? slice.getChildJobTitle().getName() : "Member")
                            .targetValue(slice.getChildAssignment().getTargetValue())
                            .actualResult(slice.getChildAssignment().getEvidences())
                            .feedbackNote(slice.getChildFeedbackNote())
                            .feedbackTargetRoleCode(slice.getChildFeedbackTargetRoleCode())
                            .selfScore(childSelfScore)
                            .pmScore(supervisorPortfolioScore(slice.getChildAssignment()))
                            .gmEvaluationComment(gmCommentFromEvidencesJson(slice.getChildAssignment().getEvidences()))
                            .statusCode(slice.getChildAssignment().getStatusCode())
                            .updateReason(slice.getChildAssignment().getUpdateReason())
                            .build());
                }
            }
        }

        // Get cycle info for response
        KpiCycleResponse cycleResponse = cycleOpt
                .map(cycle -> {
                    KpiCycleResponse resp = new KpiCycleResponse();
                    resp.setId(cycle.getId());
                    resp.setYear(cycle.getYear());
                    resp.setName(cycle.getName());
                    resp.setGoalSettingStart(cycle.getGoalSettingStart());
                    resp.setGoalSettingEnd(cycle.getGoalSettingEnd());
                    resp.setMidYearStart(cycle.getMidYearStart());
                    resp.setMidYearEnd(cycle.getMidYearEnd());
                    resp.setEndYearStart(cycle.getEndYearStart());
                    resp.setEndYearEnd(cycle.getEndYearEnd());
                    return resp;
                })
                .orElse(null);
        return PmDashboardResponse.builder()
            .kpis(new ArrayList<>(kpiGroupMap.values()))
            .asmStatuses(asmStatuses != null ? asmStatuses : List.of())
            .kpiCycle(cycleResponse)
            .evaluationCommentsPortfolio(summary != null ? summary.getEvaluationComments() : null)
            .evaluationCommentsPromotion(summary != null ? summary.getEvaluationCommentsPromotion() : null)
            .build();
    }

    public List<TeamMemberResponse> getTeamHierarchy(UUID pmId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();

        List<UserTeamHierarchyAggregate> aggregates = userMapper.findTeamHierarchyBySupervisor(pmId, cycleId);
        
        Map<UUID, TeamMemberResponse> lookupMap = new HashMap<>();
        List<TeamMemberResponse> roots = new ArrayList<>();

        for (UserTeamHierarchyAggregate agg : aggregates) {
            List<KpiAssignmentDetailAggregate> memberDetails =
                    kpiAssignmentMapper.findKpiDetailsByUserAndCycle(agg.getId(), cycleId);
            BigDecimal portfolioSelfScore = averageMemberScore(memberDetails, false, false);
            BigDecimal portfolioPmScore = averageMemberScore(memberDetails, false, true);
            BigDecimal promotionSelfScore = averageMemberScore(memberDetails, true, false);
            BigDecimal promotionPmScore = averageMemberScore(memberDetails, true, true);
            BigDecimal allSelfScore = averageAllMemberScore(memberDetails, false);
            BigDecimal allPmScore = averageAllMemberScore(memberDetails, true);
            Integer allStatusCode = effectiveMemberStatus(memberDetails, null);
            Integer portfolioStatusCode = effectiveMemberStatus(memberDetails, false);
            Integer promotionStatusCode = effectiveMemberStatus(memberDetails, true);

            TeamMemberResponse res = new TeamMemberResponse();
            res.setId(agg.getId());
            res.setName(agg.getFullName());
            res.setRole(agg.getJobTitle() != null ? agg.getJobTitle().getName() : "");
            res.setSupervisorId(agg.getSupervisorId());
            res.setSelfScore(allSelfScore);
            res.setPmScore(allPmScore);
            // Luôn trả nhận xét supervisor từ DB (PM hoặc GM sau hub); FE chỉ overlay draft khi còn chờ PM (501/601).
            res.setPmComment(agg.getPmComment());
            res.setStatusCode(allStatusCode); // Pass raw code
            res.setRequiresPmEvaluation(Boolean.TRUE.equals(agg.getRequiresPmEvaluation()));
            res.setPortfolioSelfScore(portfolioSelfScore);
            res.setPortfolioPmScore(portfolioPmScore);
            res.setPortfolioPmComment(agg.getPortfolioPmComment());
            res.setPortfolioStatusCode(portfolioStatusCode);
            res.setPortfolioRequiresPmEvaluation(Boolean.TRUE.equals(agg.getPortfolioRequiresPmEvaluation()));
            res.setPromotionSelfScore(promotionSelfScore);
            res.setPromotionPmScore(promotionPmScore);
            res.setPromotionPmComment(agg.getPromotionPmComment());
            res.setPromotionStatusCode(promotionStatusCode);
            res.setPromotionRequiresPmEvaluation(Boolean.TRUE.equals(agg.getPromotionRequiresPmEvaluation()));
            res.setExpanded(true);
            
            lookupMap.put(res.getId(), res);
        }

        // 2. Build Tree
        for (TeamMemberResponse res : lookupMap.values()) {
            if (pmId.equals(res.getSupervisorId())) {
                res.setDepth(0);
                roots.add(res);
            } else {
                TeamMemberResponse parent = lookupMap.get(res.getSupervisorId());
                if (parent != null) {
                    res.setDepth(parent.getDepth() + 1);
                    parent.getChildren().add(res);
                }
            }
        }

        return roots;
    }

    /**
     * Kiểm tra toàn bộ member trong cây PM đã nộp xong KPI Member (individual/team, status ≥ 501) cho PM hay chưa —
     * điều kiện trước khi PM gửi đánh giá lên GM từng member (tab KPI Member).
     */
    public PmPortfolioGateResponse getPmPortfolioEvaluationGate(UUID pmId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();
        List<PmPortfolioGatePendingMemberResponse> pending =
                userMapper.listPmPortfolioGateBlockingMembers(pmId, cycleId);
        return PmPortfolioGateResponse.builder()
                .allPortfolioSubmittedToPm(pending.isEmpty())
                .pendingMembers(pending)
                .build();
    }

    public List<MemberKpiDetailResponse> getMemberKpiDetails(UUID memberId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();

        List<KpiAssignmentDetailAggregate> aggregates = kpiAssignmentMapper.findKpiDetailsByUserAndCycle(memberId, cycleId);
        List<MemberKpiDetailResponse> result = new ArrayList<>();
        
        for (KpiAssignmentDetailAggregate agg : aggregates) {
            MemberKpiDetailResponse res = new MemberKpiDetailResponse();
            res.setId(agg.getId());
            res.setGroup(agg.getKpiCategory() != null ? agg.getKpiCategory().getName() : null);
            res.setCode(agg.getKpiMaster().getCode());
            res.setName(agg.getKpiMaster().getName());
            // Ưu tiên target member-specific (ka.target_value), fallback về ki.target_value
            BigDecimal targetVal = agg.getTargetValue() != null
                    ? agg.getTargetValue()
                    : (agg.getKpisInformation() != null ? agg.getKpisInformation().getTargetValue() : null);
            if (targetVal != null) {
                res.setTarget(targetVal.toString());
            } else if (agg.getKpisInformation() != null) {
                res.setTarget(agg.getKpisInformation().getTargetDescription());
            }
            res.setWeight(agg.getKpisInformation().getWeight());
            res.setSelfScore(effectiveSelfScore(agg));
            res.setPmScore(supervisorPortfolioScore(agg));
            // Nhận xét PM/GM theo KPI lưu trong evidences.gmComment — đọc sau giải mã evidences (SQL ->> trên DB thất bại khi JSON mã hóa).
            res.setPmComment(gmCommentFromEvidencesJson(agg.getEvidences()));
            res.setStatusCode(agg.getStatusCode());
            res.setKpiTypeCode(agg.getKpiMaster().getTypeCode());
            res.setCalcRuleCode(agg.getKpiMaster().getCalculationRuleCode());
            res.setUnitCode(agg.getKpiMaster().getUnitCode());
            res.setUnitName(agg.getUnitName());
            res.setEvidences(agg.getEvidences());
            result.add(res);
        }

        return result;
    }

    public List<PmMemberKpiApprovalItemResponse> listPendingMemberKpiApprovals(UUID pmId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();
        List<PmMemberKpiApprovalItemResponse> rows =
                kpiAssignmentMapper.listPmPendingMemberKpiApprovals(pmId, cycleId);
        for (PmMemberKpiApprovalItemResponse r : rows) {
            r.setJustification(extractJustificationFromMemberProposal(r.getTargetDescription()));
        }
        return rows;
    }

    @Transactional
    public void decideMemberKpiApproval(UUID pmId, PmMemberKpiApprovalDecisionRequest req) {
        var cycleOpt = kpiCycleMapper.findByYear(req.getYear());
        if (cycleOpt.isEmpty()) {
            throw AppException.badRequest("Can't find KPI cycle for year: " + req.getYear());
        }
        UUID cycleId = cycleOpt.get().getId();
        boolean approve = Boolean.TRUE.equals(req.getApprove());
        int newStatus = approve
                ? Constants.AssignStatus.WAITING_GM_APPROVAL
                : Constants.AssignStatus.REJECTED;
        String rejectReason = null;
        if (!approve) {
            rejectReason = req.getRejectReason() == null ? "" : req.getRejectReason().trim();
            if (rejectReason.isEmpty()) {
                throw AppException.badRequest("Please enter a rejection reason.");
            }
        }
        int n = kpiAssignmentMapper.updateMemberKpiApprovalStatusByPm(
                req.getAssignmentId(), cycleId, pmId, newStatus, pmId, rejectReason);
        if (n == 0) {
            throw AppException.badRequest(
                    "Update failed: no pending KPI found or not under PM's authority.");
        }
    }

    @Transactional
    public void decideMemberFeedback(UUID pmId, PmMemberFeedbackDecisionRequest req) {
        var cycleOpt = kpiCycleMapper.findByYear(req.getYear());
        if (cycleOpt.isEmpty()) {
            throw AppException.badRequest("Can't find KPI cycle for year: " + req.getYear());
        }
        UUID cycleId = cycleOpt.get().getId();
        int n = kpiAssignmentMapper.updateMemberFeedbackStatusByPm(
                req.getAssignmentId(), cycleId, pmId, pmId);
        if (n == 0) {
            throw AppException.badRequest(
                    "Failed to update feedback: assignment is not at feedback in progress, not under PM's authority, or feedback is pending GM review.");
        }
    }

    /**
     * Chấp nhận feedback member (407→404) và cập nhật target chỉ cho member gửi feedback.
     * Không gọi {@code assignToMembers} (xóa hết cascade) — các member khác giữ nguyên assignment/trạng thái.
     */
    @Transactional
    public void acceptMemberFeedbackWithCascade(UUID pmId, PmAcceptMemberFeedbackWithCascadeRequest req) {
        var cycleOpt = kpiCycleMapper.findByYear(req.getYear());
        if (cycleOpt.isEmpty()) {
            throw AppException.badRequest("Can't find KPI cycle for year: " + req.getYear());
        }
        UUID cycleId = cycleOpt.get().getId();
        if (!cycleId.equals(req.getCycleId())) {
            throw AppException.badRequest("cycleId does not match the cycle year.");
        }
        if (req.getParentAssignmentId() == null) {
            throw AppException.badRequest("parentAssignmentId is required for team cascade feedback.");
        }
        KpiAssignmentUserTargetRow feedbackRow = kpiAssignmentMapper.findAssignmentUserTargetByIdAndCycle(
                req.getMemberFeedbackAssignmentId(), cycleId);
        if (feedbackRow == null || feedbackRow.getUserId() == null) {
            throw AppException.badRequest("Feedback assignment not found in this cycle.");
        }
        UUID memberUserId = feedbackRow.getUserId();
        Map<UUID, BigDecimal> targets = new LinkedHashMap<>();
        for (Map.Entry<String, BigDecimal> e : req.getMemberTargets().entrySet()) {
            String key = e.getKey() == null ? "" : e.getKey().trim();
            if (key.isEmpty()) {
                continue;
            }
            BigDecimal target = e.getValue();
            if (target == null) {
                throw AppException.badRequest("Missing target for member: " + key);
            }
            try {
                targets.put(UUID.fromString(key), target);
            } catch (IllegalArgumentException ex) {
                throw AppException.badRequest("memberTargets has an invalid UUID key: " + key);
            }
        }
        BigDecimal memberTarget = targets.get(memberUserId);
        if (memberTarget == null) {
            throw AppException.badRequest("Missing target for the member who sent feedback.");
        }
        int n = kpiAssignmentMapper.updateMemberFeedbackStatusByPm(
                req.getMemberFeedbackAssignmentId(), cycleId, pmId, pmId);
        if (n == 0) {
            throw AppException.badRequest(
                    "Failed to update feedback: assignment is not at feedback in progress, not under PM's authority, or feedback is pending GM review.");
        }
        strategicKpiService.replaceFeedbackMemberCascadeAssignment(
                pmId,
                cycleId,
                req.getKpiInformationId(),
                req.getParentAssignmentId(),
                req.getMemberFeedbackAssignmentId(),
                memberUserId,
                memberTarget);
    }

    @Transactional
    public void submitFeedbackToGm(UUID pmId, PmGmFeedbackRequest req) {
        var cycleOpt = kpiCycleMapper.findByYear(req.getYear());
        if (cycleOpt.isEmpty()) {
            throw AppException.badRequest("Can't find KPI cycle for year: " + req.getYear());
        }
        UUID cycleId = cycleOpt.get().getId();
        String note = Objects.toString(req.getFeedbackNote(), "").trim();
        if (note.isEmpty()) {
            throw AppException.badRequest("Feedback note is required.");
        }
        int moved = kpiAssignmentMapper.updatePmAssignmentStatusToFeedbackInProgress(
                req.getAssignmentId(), cycleId, pmId, pmId);
        if (moved != 1) {
            throw AppException.badRequest(
                    "Cannot send feedback: KPI does not belong to PM, wrong cycle");
        }
        kpiAssignmentMapper.insertAssignmentFeedbackForGm(req.getAssignmentId(), cycleId, note, pmId);
    }

    /**
     * Tách phần mô tả member sau dòng tên KPI (format tạo KPI cá nhân) — bỏ dòng {@code Unit: ...}.
     */
    static String extractJustificationFromMemberProposal(String targetDescription) {
        if (targetDescription == null || targetDescription.isBlank()) {
            return "";
        }
        String[] lines = targetDescription.split("\\R", -1);
        if (lines.length <= 1) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i];
            String trimmed = line.trim();
            if (trimmed.startsWith("Unit:")) {
                break;
            }
            if (!trimmed.isEmpty()) {
                if (sb.length() > 0) {
                    sb.append('\n');
                }
                sb.append(line.trim());
            }
        }
        return sb.toString().trim();
    }

    /**
     * Chỉ tiêu hiển thị cho PM: target giao trên assignment PM → target số kỳ ({@code kpis_information}).
     * Không fallback sang targetDescription; thiếu target thì trả {@code null} để FE hiển thị "-".
     */
    static String resolvePmPortfolioTargetDisplay(KpiAssignment pmAssignment, KpisInformation kpiInfo) {
        if (pmAssignment != null && pmAssignment.getTargetValue() != null) {
            return pmAssignment.getTargetValue().stripTrailingZeros().toPlainString();
        }
        if (kpiInfo != null && kpiInfo.getTargetValue() != null) {
            return kpiInfo.getTargetValue().stripTrailingZeros().toPlainString();
        }
        return null;
    }

    /** PM saves comment for individual KPI during Team Review evaluation. */
    @Transactional
    public void savePmKpiComment(UUID pmId, Integer year, UUID assignmentId, String pmComment) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();

        int updated = kpiAssignmentMapper.updatePmComment(assignmentId, cycleId, pmId, pmComment);
        if (updated == 0) {
            throw AppException.badRequest(
                    "Failed to save PM comment: KPI does not belong to a member under PM's authority or wrong cycle.");
        }
    }

    /** PM lưu nhận xét tổng cho member trong user_kpi_summaries để hiển thị ở Team Review / GM Evaluation Hub. */
    @Transactional
    public void savePmSupervisorComment(UUID pmId, Integer year, UUID memberId, String pmComment, Boolean promotionScope) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();
        boolean managed = userMapper.findTeamHierarchyBySupervisor(pmId, cycleId).stream()
                .anyMatch(row -> memberId.equals(row.getId()));
        if (!managed) {
            throw AppException.badRequest("Member is not part of the team managed by this PM in this cycle.");
        }
        String comment = Objects.toString(pmComment, "").trim();
        boolean promotion = Boolean.TRUE.equals(promotionScope);
        var existing = userKpiSummaryMapper.findByUserIdAndCycleId(memberId, cycleId);
        if (existing.isPresent()) {
            if (promotion) {
                userKpiSummaryMapper.updateEvaluationSupervisorCommentsPromotion(
                        memberId, cycleId, comment, pmId, pmId);
            } else {
                userKpiSummaryMapper.updateEvaluationSupervisorComments(
                        memberId, cycleId, comment, pmId, pmId);
            }
        } else {
            userKpiSummaryMapper.insertEvaluationSupervisorComments(
                    UUID.randomUUID(),
                    memberId,
                    cycleId,
                    promotion ? null : comment,
                    promotion ? comment : null,
                    pmId,
                    pmId,
                    pmId);
        }
    }

    public PmMemberReviewMetaResponse getMemberReviewMeta(UUID pmId, UUID memberId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        UUID cycleId = cycleOpt.get().getId();
        boolean managed = userMapper.findTeamHierarchyBySupervisor(pmId, cycleId).stream()
                .anyMatch(row -> memberId.equals(row.getId()));
        if (!managed) {
            throw AppException.badRequest("Member is not part of the team managed by this PM in this cycle.");
        }
        UserKpiSummary s = userKpiSummaryMapper.findByUserIdAndCycleId(memberId, cycleId).orElse(null);
        String supP = s != null ? s.getEvaluationSupervisorComments() : null;
        String supPr = s != null ? s.getEvaluationSupervisorCommentsPromotion() : null;
        return PmMemberReviewMetaResponse.builder()
                .evaluationCommentsPortfolio(s != null ? s.getEvaluationComments() : null)
                .evaluationCommentsPromotion(s != null ? s.getEvaluationCommentsPromotion() : null)
                // Luôn trả về nhận xét supervisor đã lưu (PM hoặc GM sau hub 602) — FE tự ẩn khi còn KPI
                // chờ PM (501/601) để PM nhập mới, tránh mất nội dung GM sau khi duyệt xong.
                .supervisorCommentsPortfolio(supP)
                .supervisorCommentsPromotion(supPr)
                .build();
    }

    /**
     * PUT {@code /v1/kpi/pm/sheet/{memberId}/{assignmentId}} — lưu điểm PM ({@code end_pm_score}) chỉ khi ASM 601 (cuối kỳ).
     */
    @Transactional
    public void savePmEndPmScoreForManagedMember(UUID pmId, UUID memberUserId, UUID assignmentId, Integer pmScore) {
        if (pmScore == null || pmScore < 1 || pmScore > 5) {
            throw AppException.badRequest("PM score must be between 1 and 5.");
        }
        int n = kpiAssignmentMapper.updateEndPmScoreForPmManagedMember(
                assignmentId, memberUserId, pmId, java.math.BigDecimal.valueOf(pmScore));
        if (n != 1) {
            throw AppException.badRequest(
                    "Failed to save PM score: assignment does not belong to a member under PM's authority, or does not exist.");
        }
    }

    @Transactional
    public void deleteSelfCreatedPmKpi(UUID assignmentId, UUID pmId) {
        var row = kpisInformationMapper.selectSelfCreatedKpiInfoForPmDelete(assignmentId, pmId);
        if (row == null) {
            throw AppException.badRequest(
                    "KPI cannot be deleted (only self-created KPIs in pending/awaiting/rejected status are eligible)");
        }

        kpiAssignmentMapper.softDeleteAssignmentsForKpiInformation(
                row.getKpiInformationId(),
                row.getCycleId(),
                pmId);

        int updatedInfo = kpisInformationMapper.softDeleteKpisInformationById(row.getKpiInformationId(), pmId);
        if (updatedInfo < 1) {
            throw AppException.badRequest("KPI cannot be deleted or has already been deleted.");
        }

        int remaining = kpisInformationMapper.countActiveKpisInformationByMasterKpiId(row.getMasterKpiId());
        if (remaining == 0) {
            kpiMasterMapper.softDeleteKpiMasterById(row.getMasterKpiId(), pmId);
        }
    }
}
