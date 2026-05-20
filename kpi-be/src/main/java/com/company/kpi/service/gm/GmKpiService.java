package com.company.kpi.service.gm;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.gm.GmCopyKpiItemRequest;
import com.company.kpi.request.gm.GmCopyKpisRequest;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import com.company.kpi.service.kpi.KpiAssignmentSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * GmKpiService — GM KPI dashboard và section details.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GmKpiService {

    private static final int KPI_TYPE_TEAM = 102;

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiAssignmentSnapshotService kpiAssignmentSnapshotService;
    private final UserMapper userMapper;

    public GmKpiDashboardResponse getDashboard(Integer year) {
        throw new UnsupportedOperationException("GmKpiService.getDashboard() not yet implemented. Use mock mode.");
    }

    public List<KpiSectionMemberResponse> getSectionMembers(UUID sectionId, Integer year) {
        throw new UnsupportedOperationException("GmKpiService.getSectionMembers() not yet implemented.");
    }

    public List<MemberKpiAssignmentDTO> getMemberKpiAssignments(UUID userId, UUID cycleId) {
        return kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycleId);
    }

    @Transactional
    public void copyKpisToMember(UUID targetUserId, GmCopyKpisRequest request, UUID gmUserId) {
        UUID cycleId = request.getCycleId();
        UUID sourceUserId = request.getSourceUserId();
        if (sourceUserId.equals(targetUserId)) {
            throw AppException.badRequest("Source and target member must be different.");
        }

        List<UUID> assigneeIds = List.of(targetUserId);
        List<UUID> existingActiveUserIds = userMapper.listExistingActiveUserIds(assigneeIds);
        if (existingActiveUserIds.size() != 1) {
            throw AppException.badRequest("Target member is invalid or inactive.");
        }

        Map<UUID, UUID> jobByUser = userMapper.listUserJobTitlesByIds(assigneeIds).stream()
                .collect(Collectors.toMap(UserJobTitlePair::getUserId, UserJobTitlePair::getJobTitleId, (a, b) -> a));

        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        for (GmCopyKpiItemRequest item : request.getItems()) {
            if (item.getKpiInfoId() == null) {
                continue;
            }
            UUID parentAssignmentId = resolveParentAssignmentIdForCopy(
                    sourceUserId, cycleId, item.getKpiInfoId());

            rows.add(KpiAssignmentInsertRow.builder()
                    .id(UUID.randomUUID())
                    .cycleId(cycleId)
                    .kpiInfoId(item.getKpiInfoId())
                    .userId(targetUserId)
                    .jobTitleId(jobByUser.get(targetUserId))
                    .parentAssignmentId(parentAssignmentId)
                    .targetValue(item.getTargetValue())
                    .statusCode(Constants.AssignStatus.PENDING_ACCEPTANCE)
                    .createdBy(gmUserId)
                    .build());
        }

        if (!rows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(rows);
            kpiAssignmentSnapshotService.createSnapshotsForInsertRows(rows, gmUserId);
        }
    }

    /**
     * Team (102): giữ {@code parent_assignment_id} của member nguồn (= id assignment gốc PM nhánh đó).
     * Individual / Promotion: {@code null}.
     */
    private UUID resolveParentAssignmentIdForCopy(UUID sourceUserId, UUID cycleId, UUID kpiInfoId) {
        KpiAssignmentUserTargetRow source = kpiAssignmentMapper.findSourceAssignmentForGmCopy(
                sourceUserId, cycleId, kpiInfoId);
        if (source == null || source.getKpiTypeCode() == null) {
            return null;
        }
        if (source.getKpiTypeCode() != KPI_TYPE_TEAM) {
            return null;
        }
        return source.getParentAssignmentId();
    }
}
