package com.company.kpi.service.pm;

import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.pm.PmDashboardResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PmDashboardService {

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    public PmDashboardResponse getDashboardInitialization(UUID pmId, Integer year) {
        
        // lấy cycle id từ mapper (sử dụng findByYear hiện có)
        var cycleOpt = kpiCycleMapper.findByYear(year);
        if (cycleOpt.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy chu kỳ KPI cho năm: " + year);
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

        return PmDashboardResponse.builder()
            .kpis(new ArrayList<>(kpiGroupMap.values()))
            .build();
    }
}