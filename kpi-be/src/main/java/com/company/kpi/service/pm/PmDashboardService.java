package com.company.kpi.service.pm;

import com.company.kpi.aggregate.KpiAssignmentDetailAggregate;
import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.aggregate.UserTeamHierarchyAggregate;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.pm.PmMemberKpiApprovalDecisionRequest;
import com.company.kpi.request.pm.PmMemberFeedbackDecisionRequest;
import com.company.kpi.request.pm.PmGmFeedbackRequest;
import com.company.kpi.response.common.KpiCycleResponse;
import com.company.kpi.response.pm.MemberKpiDetailResponse;
import com.company.kpi.response.gm.GmProcessTimelineResponse;
import com.company.kpi.response.pm.PmDashboardResponse;
import com.company.kpi.response.pm.PmMemberKpiApprovalItemResponse;
import com.company.kpi.response.pm.TeamMemberResponse;
import com.company.kpi.service.gm.GmProcessTimelineService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.entity.KpisInformation;

@Service
@RequiredArgsConstructor
public class PmDashboardService {

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final UserMapper userMapper;
    private final GmProcessTimelineService gmProcessTimelineService;

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

        List<PmDashboardAggregate> aggregates = kpiAssignmentMapper.findPmPortfolioByPmIdAndCycleId(pmId, cycleId);

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
                        .actualResult(agg.getPmAssignment().getEvidences())
                        .feedbackNote(agg.getPmFeedbackNote())
                        .selfScore(pmSelfScore)
                        .pmScore(agg.getPmAssignment().getEndPmScore())
                        .isTree(agg.getKpiMaster() != null && agg.getKpiMaster().getTypeCode() != null && agg.getKpiMaster().getTypeCode() == 102)
                        .expanded(true)
                        .build();
            });

            if (agg.getChildAssignment() != null && agg.getChildAssignment().getId() != null) {
                BigDecimal childSelfScore = agg.getChildAssignment().getEndSelfScore() != null
                        ? agg.getChildAssignment().getEndSelfScore()
                        : agg.getChildAssignment().getMidSelfScore();

                groupDto.getChildren().add(PmDashboardResponse.KpiChildDto.builder()
                        .id(agg.getChildAssignment().getId())
                        .userId(agg.getChildUser() != null ? agg.getChildUser().getId() : null)
                        .name(agg.getChildUser() != null ? agg.getChildUser().getFullName() : "Unknown")
                        .role(agg.getChildJobTitle() != null ? agg.getChildJobTitle().getName() : "Member")
                        .targetValue(agg.getChildAssignment().getTargetValue())
                        .actualResult(agg.getChildAssignment().getEvidences())
                        .feedbackNote(agg.getChildFeedbackNote())
                        .selfScore(childSelfScore)
                        .pmScore(agg.getChildAssignment().getEndPmScore())
                        .statusCode(agg.getChildAssignment().getStatusCode())
                        .build());
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
            .kpiCycle(cycleResponse)
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
            TeamMemberResponse res = new TeamMemberResponse();
            res.setId(agg.getId());
            res.setName(agg.getFullName());
            res.setRole(agg.getJobTitle() != null ? agg.getJobTitle().getName() : "");
            res.setSupervisorId(agg.getSupervisorId());
            res.setSelfScore(agg.getSelfScore());
            res.setPmScore(agg.getPmScore());
            res.setPmComment(agg.getPmComment());
            res.setStatusCode(agg.getMinStatusCode()); // Pass raw code
            res.setRequiresPmEvaluation(Boolean.TRUE.equals(agg.getRequiresPmEvaluation()));
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
            res.setSelfScore(agg.getEndSelfScore() != null ? agg.getEndSelfScore() : agg.getMidSelfScore());
            res.setPmScore(agg.getEndPmScore());
            res.setStatusCode(agg.getStatusCode());
            res.setKpiTypeCode(agg.getKpiMaster().getTypeCode());
            res.setCalcRuleCode(agg.getKpiMaster().getCalculationRuleCode());
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
        int newStatus = Boolean.TRUE.equals(req.getApprove())
                ? Constants.AssignStatus.WAITING_GM_APPROVAL
                : Constants.AssignStatus.REJECTED;
        int n = kpiAssignmentMapper.updateMemberKpiApprovalStatusByPm(
                req.getAssignmentId(), cycleId, pmId, newStatus, pmId);
        if (n == 0) {
            throw AppException.badRequest(
                    "Không cập nhật được: không thấy KPI chờ duyệt (402) hoặc không thuộc quyền PM.");
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
                    "Không cập nhật được feedback: assignment không ở trạng thái 407 hoặc không thuộc quyền PM.");
        }
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
                    "Không thể gửi feedback: KPI không thuộc PM, sai chu kỳ hoặc không ở trạng thái 404.");
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
}