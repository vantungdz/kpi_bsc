package com.company.kpi.service.gm;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.PromotionCycle;
import com.company.kpi.mapper.DepartmentMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpisInformationMapper;
import com.company.kpi.mapper.PromotionCycleMapper;
import com.company.kpi.mapper.UserDepartmentMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.response.gm.GmPromotionCycleOptionResponse;
import com.company.kpi.request.gm.GmCopyKpiItemRequest;
import com.company.kpi.request.gm.GmCopyKpisRequest;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import com.company.kpi.service.kpi.KpiAssignmentSnapshotService;
import com.company.kpi.service.kpi.MemberAssignmentEligibilityService;
import com.company.kpi.service.kpi.PromotionAssignmentValidationService;
import com.company.kpi.util.MemberAssignmentEligibility;
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
    private final PromotionAssignmentValidationService promotionAssignmentValidationService;
    private final PromotionCycleMapper promotionCycleMapper;

    /** {@code GET /kpi/gm/promotion-cycles?year=} — dropdown khi tạo KPI promotion. */
    public List<GmPromotionCycleOptionResponse> listPromotionCycles(int year) {
        return promotionCycleMapper.listByYear(year).stream()
                .map(GmKpiService::toPromotionCycleOption)
                .toList();
    }

    private static GmPromotionCycleOptionResponse toPromotionCycleOption(PromotionCycle c) {
        return GmPromotionCycleOptionResponse.builder()
                .id(c.getId())
                .userId(c.getUserId())
                .name(c.getName())
                .startDate(c.getStartDate())
                .endDate(c.getEndDate())
                .durationMonths(c.getDurationMonths())
                .statusCode(c.getStatusCode())
                .build();
    }

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

        boolean hasPromotion = false;
        boolean hasStrategic = false;
        for (GmCopyKpiItemRequest item : itemsToCopy) {
            Integer tc = kpiAssignmentMapper.findKpiTypeCodeByKpiInfoId(item.getKpiInfoId());
            if (tc == null) {
                continue;
            }
            if (tc == KPI_TYPE_PROMOTION) {
                hasPromotion = true;
            } else if (tc == KPI_TYPE_INDIVIDUAL || tc == KPI_TYPE_TEAM) {
                hasStrategic = true;
            }
        }
        if (hasStrategic) {
            memberAssignmentEligibilityService.assertEligibleForStrategicAssignment(
                    cycleId,
                    List.of(targetUserId),
                    MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE);
        }
        if (hasPromotion) {
            memberAssignmentEligibilityService.assertEligibleForPromotionAssignment(
                    cycleId, List.of(targetUserId));
        }

        Map<UUID, UUID> parentByKpiInfoId = new HashMap<>();
        for (GmCopyKpiItemRequest item : itemsToCopy) {
            UUID kpiInfoId = item.getKpiInfoId();
            parentByKpiInfoId.computeIfAbsent(kpiInfoId,
                    id -> resolveParentAssignmentIdForCopy(targetUserId, cycleId, id));
        }

        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        for (GmCopyKpiItemRequest item : itemsToCopy) {
            UUID kpiInfoId = item.getKpiInfoId();
            Integer typeCode = kpiAssignmentMapper.findKpiTypeCodeByKpiInfoId(kpiInfoId);
            UUID parentId = parentByKpiInfoId.get(kpiInfoId);
            String catalogJson = kpisInformationMapper.selectTargetDescriptionJson(kpiInfoId);
            String scoringScale = resolveScoringScaleForCopy(parentId, cycleId, catalogJson);
            UUID promotionCycleId = null;
            if (typeCode != null && typeCode == KPI_TYPE_PROMOTION) {
                promotionCycleId = promotionAssignmentValidationService.resolvePromotionCycleIdForCopy(
                        kpiInfoId, targetUserId);
                promotionAssignmentValidationService.assertValidPromotionAssignment(
                        KPI_TYPE_PROMOTION, targetUserId, null, promotionCycleId, null);
            }
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
                    .promotionCycleId(promotionCycleId)
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
        return catalogScoringJson;
    }
}
