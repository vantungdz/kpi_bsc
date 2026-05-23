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

    private final KpiAssignmentMapper kpiAssignmentMapper;

    public void assertEligibleForNewMemberAssignment(UUID cycleId, Collection<UUID> userIds) {
        assertEligibleForNewAssignment(cycleId, userIds, MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE);
    }

    public void assertEligibleForNewPmAssignment(UUID cycleId, Collection<UUID> userIds) {
        assertEligibleForNewAssignment(cycleId, userIds, MemberAssignmentEligibility.BLOCK_ASSIGN_PM_MESSAGE);
    }

    /** Giao KPI mới cho member hoặc PM — cùng rule ASM, khác thông báo. */
    public void assertEligibleForNewAssignment(
            UUID cycleId, Collection<UUID> userIds, String blockMessage) {
        if (cycleId == null || userIds == null || userIds.isEmpty()) {
            return;
        }
        List<UUID> distinct = userIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) {
            return;
        }
        List<UserBlockingAssignmentRow> blocked =
                kpiAssignmentMapper.listUsersWithBlockingKpiStatusInCycle(cycleId, new ArrayList<>(distinct));
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

    public List<UUID> listBlockedUserIdsInCycle(UUID cycleId) {
        if (cycleId == null) {
            return List.of();
        }
        List<UUID> ids = kpiAssignmentMapper.listUserIdsWithBlockingKpiStatusInCycle(cycleId);
        return ids != null ? ids : List.of();
    }
}
