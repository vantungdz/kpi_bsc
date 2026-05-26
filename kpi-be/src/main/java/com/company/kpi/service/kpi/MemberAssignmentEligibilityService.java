package com.company.kpi.service.kpi;

import com.company.kpi.aggregate.UserBlockingAssignmentRow;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.util.MemberAssignmentEligibility;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberAssignmentEligibilityService {

    /** Nhóm 1: Individual (101) + Team (102) — chặn gán chung. */
    private static final List<Integer> STRATEGIC_KPI_TYPE_CODES = List.of(
            MemberAssignmentEligibility.KPI_TYPE_INDIVIDUAL,
            MemberAssignmentEligibility.KPI_TYPE_TEAM);

    /** Nhóm 2: Promotion (103) — tách khỏi nhóm strategic. */
    private static final List<Integer> PROMOTION_KPI_TYPE_CODES =
            List.of(MemberAssignmentEligibility.KPI_TYPE_PROMOTION);

    private final KpiAssignmentMapper kpiAssignmentMapper;

    /**
     * Giao KPI strategic (101 hoặc 102) — xét mọi assignment 101/102 đang active trong chu kỳ.
     */
    public void assertEligibleForNewMemberAssignment(
            UUID cycleId, Collection<UUID> userIds, int kpiTypeCode) {
        if (kpiTypeCode == MemberAssignmentEligibility.KPI_TYPE_PROMOTION) {
            assertEligibleForPromotionAssignment(cycleId, userIds);
        } else {
            assertEligibleForStrategicAssignment(
                    cycleId, userIds, MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE);
        }
    }

    /** PM nhận KPI team — cùng nhóm chặn với individual/team member (101 + 102). */
    public void assertEligibleForNewPmAssignment(UUID cycleId, Collection<UUID> userIds) {
        assertEligibleForStrategicAssignment(
                cycleId, userIds, MemberAssignmentEligibility.BLOCK_ASSIGN_PM_MESSAGE);
    }

    public void assertEligibleForStrategicAssignment(
            UUID cycleId, Collection<UUID> userIds, String blockMessage) {
        assertEligibleForNewAssignment(cycleId, userIds, STRATEGIC_KPI_TYPE_CODES, blockMessage);
    }

    public void assertEligibleForPromotionAssignment(UUID cycleId, Collection<UUID> userIds) {
        assertEligibleForNewAssignment(
                cycleId,
                userIds,
                PROMOTION_KPI_TYPE_CODES,
                MemberAssignmentEligibility.BLOCK_ASSIGN_PROMOTION_MESSAGE);
    }

    public void assertEligibleForNewAssignment(
            UUID cycleId,
            Collection<UUID> userIds,
            List<Integer> kpiTypeCodes,
            String blockMessage) {
        if (cycleId == null || userIds == null || userIds.isEmpty()) {
            return;
        }
        List<UUID> distinct = userIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) {
            return;
        }
        List<UserBlockingAssignmentRow> blocked = kpiAssignmentMapper.listUsersWithBlockingKpiStatusInCycle(
                cycleId, new ArrayList<>(distinct), kpiTypeCodes);
        if (blocked.isEmpty()) {
            return;
        }
        String names = blocked.stream()
                .map(r -> {
                    String n = r.getFullName();
                    if (n != null && !n.isBlank()) {
                        return n.trim();
                    }
                    return r.getUserId() != null ? r.getUserId().toString() : "?";
                })
                .collect(Collectors.joining(", "));
        String prefix = blockMessage != null && !blockMessage.isBlank()
                ? blockMessage.trim()
                : MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE;
        throw AppException.badRequest(prefix + " (" + names + ")");
    }

    /**
     * @param assignmentScope {@code strategic} (101+102) hoặc {@code promotion} (103)
     */
    public List<UUID> listBlockedUserIdsInCycle(UUID cycleId, String assignmentScope) {
        if (cycleId == null) {
            return List.of();
        }
        List<Integer> typeCodes = typeCodesForAssignmentScope(assignmentScope);
        if (typeCodes.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = kpiAssignmentMapper.listUserIdsWithBlockingKpiStatusInCycle(cycleId, typeCodes);
        return ids != null ? ids : List.of();
    }

    static List<Integer> typeCodesForAssignmentScope(String assignmentScope) {
        if (assignmentScope == null) {
            return List.of();
        }
        return switch (assignmentScope.trim().toLowerCase()) {
            case "strategic" -> STRATEGIC_KPI_TYPE_CODES;
            case "promotion" -> PROMOTION_KPI_TYPE_CODES;
            default -> List.of();
        };
    }
}
