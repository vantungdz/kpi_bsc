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
import com.company.kpi.response.pm.TeamMemberResponse;
import com.company.kpi.service.common.AssigneeEditBaselineSupport;
import com.company.kpi.service.gm.GmProcessTimelineService;
import com.company.kpi.service.gm.PromotionProcessTimelineService;
import com.company.kpi.response.gm.GmPromotionProcessTimelineResponse;
import com.company.kpi.service.kpi.KpiScoringRulesService;
import com.company.kpi.service.kpi.StrategicKpiService;
import com.company.kpi.util.MemberEvaluationVisibility;
import com.company.kpi.common.security.SensitiveDataCryptoService;

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

    private final SensitiveDataCryptoService sensitiveDataCryptoService;

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

    /** GM đã chấm và điểm khác PM (chỉ cuối kỳ — dùng cho drawer PM). */
    private static boolean gmScoreChangedFromPmAndGm(BigDecimal endPmScore, BigDecimal endGmScore) {
        if (endPmScore == null || endGmScore == null) {
            return false;
        }
        return endPmScore.compareTo(endGmScore) != 0;
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

    /** {@code promotion_cycle_id} chỉ khi KPI promotion (103). */
    private static UUID promotionCycleIdForPmPortfolioRow(PmDashboardAggregate agg) {
        if (agg.getKpiMaster() == null || !Objects.equals(agg.getKpiMaster().getTypeCode(), 103)) {
            return null;
        }
        if (agg.getPmAssignment() == null) {
            return null;
        }
        return agg.getPmAssignment().getPromotionCycleId();
    }

    private static BigDecimal effectiveSelfScore(KpiAssignmentDetailAggregate detail) {
        if (detail == null) {
            return null;
        }
        return MemberEvaluationVisibility.resolveMemberSelfScoreByAsm(
                detail.getStatusCode(),
                detail.getMidSelfScore(),
                detail.getEndSelfScore());
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

    private static String commentFromEvidencesJson(String evidences, String key) {
        if (evidences == null) {
            return null;
        }
        String trimmed = evidences.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            JsonNode root = PM_DASHBOARD_JSON.readTree(trimmed);
            if (root == null || !root.has(key) || root.get(key).isNull()) {
                return null;
            }
            String c = root.get(key).asText("").trim();
            return c.isEmpty() ? null : c;
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Đọc {@code evidences.gmComment} (legacy {@code pmComment}), giải mã nếu còn {@code enc:v1:}
     * từ lần lưu cũ qua param {@code pmComment} bị interceptor mã hóa nhầm.
     */
    private String resolveSupervisorKpiComment(String evidences) {
        if (evidences == null) {
            return null;
        }
        String decryptedJson = sensitiveDataCryptoService.decryptEvidenceSensitiveFields(evidences);
        String raw = commentFromEvidencesJson(decryptedJson, "gmComment");
        if (raw == null) {
            raw = commentFromEvidencesJson(decryptedJson, "pmComment");
        }
        if (raw == null) {
            return null;
        }
        return sensitiveDataCryptoService.decryptIfEncrypted(raw);
    }

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiMasterMapper kpiMasterMapper;
    private final SysStatusCodeMapper sysStatusCodeMapper;
    private final UserMapper userMapper;
    private final UserKpiSummaryMapper userKpiSummaryMapper;
    private final GmProcessTimelineService gmProcessTimelineService;
    private final PromotionProcessTimelineService promotionProcessTimelineService;
    private final StrategicKpiService strategicKpiService;
    private final KpiScoringRulesService kpiScoringRulesService;
    private final AssigneeEditBaselineSupport assigneeEditBaselineSupport;

    public GmProcessTimelineResponse getProcessTimelineForPm(UUID pmId, Integer year) {
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }
        return gmProcessTimelineService.getTimelineForPm(cycleOpt.get().getId(), pmId);
    }

    public GmPromotionProcessTimelineResponse getPromotionProcessTimelineForPm(
            UUID pmId, UUID promotionCycleId) {
        return promotionProcessTimelineService.getTimelineForPm(promotionCycleId, pmId);
    }

    public PmDashboardResponse getDashboardInitialization(UUID pmId, Integer year) {
        return getDashboardInitialization(pmId, year, null);
    }

    public PmDashboardResponse getDashboardInitialization(UUID pmId, Integer year, String scope) {
        
        // lấy cycle id từ mapper (sử dụng findByYear hiện có)
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Can't find KPI cycle for year: " + year);
        }

        UUID cycleId = cycleOpt.get().getId();
        UserKpiSummary summary = userKpiSummaryMapper.findByUserIdAndCycleId(pmId, cycleId).orElse(null);
        String accountCreatedAt = userMapper.findById(pmId)
                .map(u -> u.getCreatedAt() != null ? u.getCreatedAt().toString() : null)
                .orElse(null);

        List<PmDashboardAggregate> aggregates;
        final boolean departmentScope = "department".equalsIgnoreCase(scope);
        if (departmentScope) {
            aggregates = kpiAssignmentMapper.findPmDepartmentPortfolioByPmIdAndCycleId(pmId, cycleId);
        } else {
            aggregates = kpiAssignmentMapper.findPmPortfolioByPmIdAndCycleId(pmId, cycleId);
        }

        List<SysStatusCode> asmStatuses =
                sysStatusCodeMapper.findByCategories(Arrays.asList("ASM_STATUS"));

        // Map dùng PM_Assignment_ID làm key
        Map<UUID, PmDashboardResponse.KpiGroupDto> kpiGroupMap = new LinkedHashMap<>();

        for (PmDashboardAggregate agg : aggregates) {
            if (agg.getPmAssignment() == null || agg.getPmAssignment().getId() == null) continue;
            UUID pmAsmId = agg.getPmAssignment().getId();

            PmDashboardResponse.KpiGroupDto groupDto = kpiGroupMap.computeIfAbsent(pmAsmId, id -> {
                Integer pmAsmStatus = agg.getPmAssignment().getStatusCode();
                final boolean pmOwnParentRow = !departmentScope;
                boolean pmCanViewMemberRow = pmOwnParentRow
                        ? MemberEvaluationVisibility.canPmOwnViewPortfolioEvaluation(pmAsmStatus)
                        : MemberEvaluationVisibility.canSupervisorViewMemberSelfEvaluation(
                                pmAsmStatus, false);
                BigDecimal rowSelfScore = pmOwnParentRow
                        ? MemberEvaluationVisibility.resolvePmOwnPortfolioSelfScore(
                                pmAsmStatus,
                                agg.getPmAssignment().getMidSelfScore(),
                                agg.getPmAssignment().getEndSelfScore())
                        : MemberEvaluationVisibility.resolvePortfolioMemberSelfScore(
                                pmAsmStatus,
                                agg.getPmAssignment().getMidSelfScore(),
                                agg.getPmAssignment().getEndSelfScore(),
                                false);
                String rowEvidences =
                        pmCanViewMemberRow ? agg.getPmAssignment().getEvidences() : null;
                String rowSupervisorComment = resolveSupervisorKpiComment(rowEvidences);

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
                                resolveEffectiveScoringJson(agg.getPmAssignment(), agg.getKpiInfo()))
                        .allowAssigneeTargetScaleEdit(
                                agg.getKpiInfo() != null
                                        && Boolean.TRUE.equals(agg.getKpiInfo().getAllowAssigneeTargetScaleEdit()))
                        .weight(agg.getKpiInfo() != null ? agg.getKpiInfo().getWeight() : null)
                        .statusCode(agg.getPmAssignment() != null ? agg.getPmAssignment().getStatusCode() : null)
                        .updateReason(agg.getPmAssignment() != null ? agg.getPmAssignment().getUpdateReason() : null)
                        .actualResult(rowEvidences)
                        .feedbackNote(agg.getPmFeedbackNote())
                        .selfScore(rowSelfScore)
                        .midSelfScore(agg.getPmAssignment().getMidSelfScore())
                        .endSelfScore(agg.getPmAssignment().getEndSelfScore())
                        .pmScore(supervisorPortfolioScoreForPmNode(
                                agg.getPmAssignment(),
                                agg.getCascadeChildren(),
                                pmId,
                                agg.getKpiMaster() != null ? agg.getKpiMaster().getTypeCode() : null))
                        .endPmScore(agg.getPmAssignment().getEndPmScore())
                        .endGmScore(agg.getPmAssignment().getEndGmScore())
                        .gmScoreChanged(
                                gmScoreChangedFromPmAndGm(
                                        agg.getPmAssignment().getEndPmScore(),
                                        agg.getPmAssignment().getEndGmScore()))
                        .gmEvaluationComment(rowSupervisorComment)
                        .isTree(agg.getKpiMaster() != null && agg.getKpiMaster().getTypeCode() != null && agg.getKpiMaster().getTypeCode() == 102)
                        .expanded(true)
                        .isSelfCreated(pmId.equals(agg.getPmAssignment().getCreatedBy()))
                        .creatorRoleCode(trimUpperOrNull(agg.getKpiCreatorRoleCode()))
                        .userId(agg.getParentUserId())
                        .userName(agg.getParentUserName())
                        .userRole(agg.getParentJobTitleName())
                        .promotionCycleId(promotionCycleIdForPmPortfolioRow(agg))
                        .build();
            });

            if (agg.getCascadeChildren() != null) {
                for (PmPortfolioCascadeChildRow slice : agg.getCascadeChildren()) {
                    if (slice.getChildAssignment() == null || slice.getChildAssignment().getId() == null) {
                        continue;
                    }
                    Integer childStatusCode = slice.getChildAssignment().getStatusCode();
                    UUID childUserId =
                            slice.getChildUser() != null ? slice.getChildUser().getId() : null;
                    boolean pmOwnChildRow = pmId.equals(childUserId);
                    boolean pmCanViewMemberEval = pmOwnChildRow
                            ? MemberEvaluationVisibility.canPmOwnViewPortfolioEvaluation(childStatusCode)
                            : MemberEvaluationVisibility.canSupervisorViewMemberSelfEvaluation(
                                    childStatusCode, false);
                    BigDecimal childSelfScore = pmOwnChildRow
                            ? MemberEvaluationVisibility.resolvePmOwnPortfolioSelfScore(
                                    childStatusCode,
                                    slice.getChildAssignment().getMidSelfScore(),
                                    slice.getChildAssignment().getEndSelfScore())
                            : MemberEvaluationVisibility.resolvePortfolioMemberSelfScore(
                                    childStatusCode,
                                    slice.getChildAssignment().getMidSelfScore(),
                                    slice.getChildAssignment().getEndSelfScore(),
                                    false);
                    String childEvidences = pmCanViewMemberEval
                            ? slice.getChildAssignment().getEvidences()
                            : null;

                    String childSupervisorComment = resolveSupervisorKpiComment(childEvidences);

                    groupDto.getChildren().add(PmDashboardResponse.KpiChildDto.builder()
                            .id(slice.getChildAssignment().getId())
                            .userId(slice.getChildUser() != null ? slice.getChildUser().getId() : null)
                            .name(slice.getChildUser() != null ? slice.getChildUser().getFullName() : "Unknown")
                            .role(slice.getChildJobTitle() != null ? slice.getChildJobTitle().getName() : "Member")
                            .targetValue(slice.getChildAssignment().getTargetValue())
                            .targetDescriptionJson(
                                    resolveEffectiveScoringJson(
                                            slice.getChildAssignment(), agg.getKpiInfo()))
                            .actualResult(childEvidences)
                            .feedbackNote(slice.getChildFeedbackNote())
                            .feedbackTargetRoleCode(slice.getChildFeedbackTargetRoleCode())
                            .selfScore(childSelfScore)
                            .midSelfScore(slice.getChildAssignment().getMidSelfScore())
                            .endSelfScore(slice.getChildAssignment().getEndSelfScore())
                            .pmScore(supervisorPortfolioScore(slice.getChildAssignment()))
                            .endPmScore(slice.getChildAssignment().getEndPmScore())
                            .endGmScore(slice.getChildAssignment().getEndGmScore())
                            .gmScoreChanged(
                                    gmScoreChangedFromPmAndGm(
                                            slice.getChildAssignment().getEndPmScore(),
                                            slice.getChildAssignment().getEndGmScore()))
                            .gmEvaluationComment(childSupervisorComment)
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
            .accountCreatedAt(accountCreatedAt)
            .evaluationCommentsPortfolio(summary != null ? summary.getEvaluationComments() : null)
            .evaluationCommentsPromotion(summary != null ? summary.getEvaluationCommentsPromotion() : null)
            .evaluationSupervisorComments(
                    summary != null ? summary.getEvaluationSupervisorComments() : null)
            .evaluationSupervisorCommentsPromotion(
                    summary != null ? summary.getEvaluationSupervisorCommentsPromotion() : null)
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
            // Drawer đánh giá PM: luôn trả self score & evidences; tab KPI Department/Personal vẫn lọc ở portfolio API.
            res.setSelfScore(
                    MemberEvaluationVisibility.resolveDrawerMemberSelfScore(
                            agg.getStatusCode(),
                            agg.getMidSelfScore(),
                            agg.getEndSelfScore()));
            res.setPmScore(supervisorPortfolioScore(agg));
            res.setEndPmScore(agg.getEndPmScore());
            res.setEndGmScore(agg.getEndGmScore());
            res.setGmScoreChanged(gmScoreChangedFromPmAndGm(agg.getEndPmScore(), agg.getEndGmScore()));
            // Nhận xét PM/GM theo KPI lưu trong evidences.gmComment — đọc sau giải mã evidences (SQL ->> trên DB thất bại khi JSON mã hóa).
            String evidencesForPm =
                    sensitiveDataCryptoService.decryptEvidenceSensitiveFields(agg.getEvidences());
            res.setPmComment(resolveSupervisorKpiComment(evidencesForPm));
            res.setStatusCode(agg.getStatusCode());
            res.setStatusName(agg.getStatusName());
            res.setStatusDesc(agg.getStatusDesc());
            res.setKpiTypeCode(agg.getKpiMaster().getTypeCode());
            res.setCalcRuleCode(agg.getKpiMaster().getCalculationRuleCode());
            res.setCalculationTypeCode(agg.getKpiMaster().getCalculationTypeCode());
            res.setUnitCode(agg.getKpiMaster().getUnitCode());
            res.setUnitName(agg.getUnitName());
            res.setEvidences(evidencesForPm);
            if (agg.getKpiMaster() != null
                    && Objects.equals(agg.getKpiMaster().getTypeCode(), 102)
                    && agg.getParentAssignmentId() != null) {
                res.setTeamPmParentStatusCode(agg.getTeamPmParentStatusCode());
            }
            res.setCreatorRoleCode(trimUpperOrNull(agg.getKpiCreatorRoleCode()));
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
            assigneeEditBaselineSupport.enrichPmApprovalItem(r);
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
        if (!approve
                && newStatus == Constants.AssignStatus.REJECTED
                && Boolean.TRUE.equals(req.getResetDrawerSiblingsToPendingAcceptance())) {
            kpiAssignmentMapper.resetPmMemberApprovalSiblingsToPendingAcceptance(
                    req.getAssignmentId(), cycleId, pmId, pmId);
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

    /** Thang điểm hiển thị: assignment {@code scoring_scale} nếu có, không thì catalog. */
    static String resolveEffectiveScoringJson(KpiAssignment assignment, KpisInformation kpiInfo) {
        if (assignment != null) {
            String scale = assignment.getScoringScale();
            if (scale != null && !scale.isBlank() && !"null".equalsIgnoreCase(scale.trim())) {
                return scale;
            }
        }
        return kpiInfo != null ? kpiInfo.getTargetDescription() : null;
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

        String comment = Objects.toString(pmComment, "").trim();
        int updated = kpiAssignmentMapper.updatePmComment(assignmentId, cycleId, pmId, comment);
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
        UUID cycleId = kpiAssignmentMapper.findCycleIdByAssignmentId(assignmentId);
        if (cycleId != null
                && kpiAssignmentMapper.existsTeamMemberReviewBlockedByPmPendingAcceptance(
                        pmId, cycleId, memberUserId, 601)) {
            throw AppException.badRequest(
                    "Accept the Team KPI before reviewing member evaluation results.");
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
