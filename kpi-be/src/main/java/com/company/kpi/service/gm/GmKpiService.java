package com.company.kpi.service.gm;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.DepartmentMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpisInformationMapper;
import com.company.kpi.mapper.UserDepartmentMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.gm.GmCopyKpiItemRequest;
import com.company.kpi.request.gm.GmCopyKpisRequest;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import com.company.kpi.service.kpi.KpiAssignmentSnapshotService;
import com.company.kpi.service.kpi.MemberAssignmentEligibilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
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

    private static final int KPI_TYPE_INDIVIDUAL = 101;
    private static final int KPI_TYPE_TEAM = 102;
    private static final int KPI_TYPE_PROMOTION = 103;

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiAssignmentSnapshotService kpiAssignmentSnapshotService;
    private final UserMapper userMapper;
    private final UserDepartmentMapper userDepartmentMapper;
    private final DepartmentMapper departmentMapper;
    private final MemberAssignmentEligibilityService memberAssignmentEligibilityService;

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

        List<GmCopyKpiItemRequest> itemsToCopy = request.getItems().stream()
                .filter(item -> item.getKpiInfoId() != null)
                .toList();
        if (itemsToCopy.isEmpty()) {
            return;
        }

        memberAssignmentEligibilityService.assertEligibleForNewMemberAssignment(
                cycleId, List.of(targetUserId));

        Map<UUID, UUID> parentByKpiInfoId = new HashMap<>();
        for (GmCopyKpiItemRequest item : itemsToCopy) {
            UUID kpiInfoId = item.getKpiInfoId();
            parentByKpiInfoId.computeIfAbsent(kpiInfoId,
                    id -> resolveParentAssignmentIdForCopy(targetUserId, cycleId, id));
        }

        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        for (GmCopyKpiItemRequest item : itemsToCopy) {
            UUID kpiInfoId = item.getKpiInfoId();
            UUID parentId = parentByKpiInfoId.get(kpiInfoId);
            String catalogJson = kpisInformationMapper.selectTargetDescriptionJson(kpiInfoId);
            String scoringScale = resolveScoringScaleForCopy(parentId, cycleId, catalogJson);
            rows.add(KpiAssignmentInsertRow.builder()
                    .id(UUID.randomUUID())
                    .cycleId(cycleId)
                    .kpiInfoId(kpiInfoId)
                    .userId(targetUserId)
                    .jobTitleId(jobByUser.get(targetUserId))
                    .parentAssignmentId(parentId)
                    .targetValue(item.getTargetValue())
                    .scoringScale(scoringScale)
                    .statusCode(Constants.AssignStatus.PENDING_ACCEPTANCE)
                    .createdBy(gmUserId)
                    .build());
        }

        kpiAssignmentMapper.insertKpiAssignments(rows);
        kpiAssignmentSnapshotService.createSnapshotsForInsertRows(rows, gmUserId);
    }

    /**
     * Team (102): {@code parent_assignment_id} = assignment gốc PM của phòng ban chính của member đích
     * (bắt buộc không null). Individual (101) / Promotion (103): {@code null}.
     */
    private UUID resolveParentAssignmentIdForCopy(UUID targetUserId, UUID cycleId, UUID kpiInfoId) {
        Integer typeCode = kpiAssignmentMapper.findKpiTypeCodeByKpiInfoId(kpiInfoId);
        if (typeCode == null) {
            throw AppException.badRequest("KPI not found or invalid.");
        }
        if (typeCode == KPI_TYPE_INDIVIDUAL || typeCode == KPI_TYPE_PROMOTION) {
            return null;
        }
        if (typeCode != KPI_TYPE_TEAM) {
            throw AppException.badRequest("Unsupported KPI type for copy: " + typeCode);
        }

        UUID primaryDeptId = userDepartmentMapper.findPrimaryDepartmentIdByUserId(targetUserId);
        if (primaryDeptId == null) {
            throw AppException.badRequest("Target member has no primary department.");
        }

        UUID pmId = departmentMapper.getManagerIdByDepartmentId(primaryDeptId);
        if (pmId == null) {
            throw AppException.badRequest("Target department has no manager (PM).");
        }

        UUID pmRootAssignmentId = kpiAssignmentMapper.findPmRootAssignmentIdForGmCopy(pmId, cycleId, kpiInfoId);
        if (pmRootAssignmentId == null) {
            throw AppException.badRequest(
                    "Team KPI is not assigned to this department's PM in this cycle. "
                            + "Assign the team KPI to the PM before copying to a member.");
        }
        return pmRootAssignmentId;
    }

    private String resolveScoringScaleForCopy(UUID parentAssignmentId, UUID cycleId, String catalogScoringJson) {
        if (parentAssignmentId != null) {
            String parentScale = kpiAssignmentMapper.selectScoringScaleJson(parentAssignmentId, cycleId);
            if (parentScale != null && !parentScale.isBlank() && !"null".equalsIgnoreCase(parentScale.trim())) {
                return parentScale;
            }
        }
        return catalogScoringJson;
    }
}
