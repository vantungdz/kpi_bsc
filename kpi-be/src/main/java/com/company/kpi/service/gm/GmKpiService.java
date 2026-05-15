package com.company.kpi.service.gm;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.request.gm.GmCopyKpisRequest;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import com.company.kpi.service.kpi.KpiAssignmentSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * GmKpiService — GM KPI dashboard và section details.
 *
 * TODO: Implement với KpiPeriodMapper, KpiSheetMapper, UserMapper, SectionMapper
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GmKpiService {

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiAssignmentSnapshotService kpiAssignmentSnapshotService;

    public GmKpiDashboardResponse getDashboard(Integer year) {
        // TODO: query database and build response
        throw new UnsupportedOperationException("GmKpiService.getDashboard() not yet implemented. Use mock mode.");
    }

    public List<KpiSectionMemberResponse> getSectionMembers(UUID sectionId, Integer year) {
        // TODO: query database
        throw new UnsupportedOperationException("GmKpiService.getSectionMembers() not yet implemented.");
    }

    public List<MemberKpiAssignmentDTO> getMemberKpiAssignments(UUID userId, UUID cycleId) {
        return kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycleId);
    }

    public void copyKpisToMember(UUID targetUserId, GmCopyKpisRequest request, UUID gmUserId) {
        List<KpiAssignmentInsertRow> rows = request.getItems().stream().map(item ->
            KpiAssignmentInsertRow.builder()
                .id(UUID.randomUUID())
                .cycleId(request.getCycleId())
                .kpiInfoId(item.getKpiInfoId())
                .userId(targetUserId)
                .jobTitleId(null) // Assuming job title is not strictly required here, or can be null
                .parentAssignmentId(null) // Copied individual KPIs usually do not link to PM parent directly in this context unless cascade is needed, but we keep it simple for GM bulk assign
                .targetValue(item.getTargetValue())
                .statusCode(404) // GM Assigned (Pending Member Confirmation)
                .createdBy(gmUserId)
                .build()
        ).toList();

        if (!rows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(rows);
            kpiAssignmentSnapshotService.createSnapshotsForInsertRows(rows, gmUserId);
        }
    }
}
