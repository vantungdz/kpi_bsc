package com.company.kpi.service.pm;

import com.company.kpi.aggregate.KpiAssignmentDetailAggregate;
import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.aggregate.UserTeamHierarchyAggregate;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.response.common.KpiCycleResponse;
import com.company.kpi.response.pm.MemberKpiDetailResponse;
import com.company.kpi.response.pm.PmDashboardResponse;
import com.company.kpi.response.pm.TeamMemberResponse;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PmDashboardService {

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final UserMapper userMapper;

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
                        .isImportant(agg.getKpiInfo() != null ? agg.getKpiInfo().getIsImportant() : null)
                        .target(agg.getKpiInfo() != null ? agg.getKpiInfo().getTargetDescription() : null)
                        .weight(agg.getKpiInfo() != null ? agg.getKpiInfo().getWeight() : null)
                        .statusCode(agg.getPmAssignment() != null ? agg.getPmAssignment().getStatusCode() : null)
                        .actualResult(agg.getPmAssignment().getEvidences())
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
                        .name(agg.getChildUser() != null ? agg.getChildUser().getFullName() : "Unknown")
                        .role(agg.getChildJobTitle() != null ? agg.getChildJobTitle().getName() : "Member")
                        .targetValue(agg.getChildAssignment().getTargetValue())
                        .actualResult(agg.getChildAssignment().getEvidences())
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
            res.setScore(agg.getTotalScore());
            res.setStatusCode(agg.getMinStatusCode()); // Pass raw code
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
        List<KpiAssignmentDetailAggregate> aggregates = kpiAssignmentMapper.findKpiDetailsByUserAndCycle(memberId, cycleId);
        List<MemberKpiDetailResponse> result = new ArrayList<>();
        
        for (KpiAssignmentDetailAggregate agg : aggregates) {
            MemberKpiDetailResponse res = new MemberKpiDetailResponse();
            res.setId(agg.getId());
            res.setGroup(agg.getKpiCategory() != null ? agg.getKpiCategory().getName() : null);
            res.setCode(agg.getKpiMaster().getCode());
            res.setName(agg.getKpiMaster().getName());
            res.setDescription(agg.getKpiMaster().getName());
            res.setTarget(agg.getKpisInformation().getTargetDescription());
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
}