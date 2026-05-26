package com.company.kpi.service.kpi;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.PromotionCycle;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.PromotionCycleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Objects;
import java.util.UUID;

/**
 * Validation for promotion KPI assignments ({@code kpi_master.type_code = 103}):
 * mandatory {@code promotion_cycle_id}, user-only assignee, no overlapping promotion windows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PromotionAssignmentValidationService {

    private static final int KPI_TYPE_PROMOTION = 103;

    private final PromotionCycleMapper promotionCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    /**
     * Before insert/update of promotion assignment rows.
     */
    public void assertValidPromotionAssignment(
            int kpiTypeCode,
            UUID assigneeUserId,
            UUID departmentId,
            UUID promotionCycleId,
            UUID excludeAssignmentId) {
        if (kpiTypeCode != KPI_TYPE_PROMOTION) {
            return;
        }
        if (departmentId != null) {
            throw AppException.badRequest(
                    "Promotion KPI cannot be assigned to a department slice. Assign to a user with a promotion cycle.");
        }
        if (assigneeUserId == null) {
            throw AppException.badRequest(
                    "Promotion KPI requires a user assignee (user_id). promotionCycleId is mandatory.");
        }
        if (promotionCycleId == null) {
            throw AppException.badRequest(
                    "promotionCycleId is required when creating or assigning a Promotion KPI (type 103).");
        }

        PromotionCycle cycle = promotionCycleMapper.findById(promotionCycleId)
                .orElseThrow(() -> AppException.notFound("Promotion cycle not found: " + promotionCycleId));

        if (cycle.getUserId() != null && !cycle.getUserId().equals(assigneeUserId)) {
            throw AppException.badRequest(
                    "promotionCycleId does not belong to the selected assignee.");
        }

        if (kpiAssignmentMapper.existsOverlappingPromotionCycleForUser(
                assigneeUserId, promotionCycleId, excludeAssignmentId)) {
            log.warn(
                    "Rejected overlapping promotion cycle for userId={} promotionCycleId={}",
                    assigneeUserId,
                    promotionCycleId);
            throw AppException.badRequest(
                    "This user already has an active promotion assignment in an overlapping promotion period. "
                            + "Complete or reject the existing promotion before assigning another cycle.");
        }

        log.debug(
                "Promotion assignment validation OK userId={} promotionCycleId={}",
                assigneeUserId,
                promotionCycleId);
    }

    public void assertValidPromotionAssignmentsForInsertRows(
            int kpiTypeCode, Collection<PromotionAssignmentInsert> rows) {
        if (kpiTypeCode != KPI_TYPE_PROMOTION || rows == null || rows.isEmpty()) {
            return;
        }
        for (PromotionAssignmentInsert row : rows) {
            assertValidPromotionAssignment(
                    kpiTypeCode,
                    row.userId(),
                    row.departmentId(),
                    row.promotionCycleId(),
                    null);
        }
    }

    /**
     * Resolve promotion cycle when GM copies promotion KPI to another member.
     */
    public UUID resolvePromotionCycleIdForCopy(UUID kpiInfoId, UUID targetUserId) {
        Objects.requireNonNull(targetUserId, "targetUserId");
        UUID fromKpi = kpiAssignmentMapper.findPromotionCycleIdByKpiInfoId(kpiInfoId);
        if (fromKpi != null) {
            PromotionCycle cycle = promotionCycleMapper.findById(fromKpi).orElse(null);
            if (cycle != null
                    && (cycle.getUserId() == null || targetUserId.equals(cycle.getUserId()))) {
                return fromKpi;
            }
        }
        return promotionCycleMapper.findLatestByUserId(targetUserId)
                .map(PromotionCycle::getId)
                .orElseThrow(() -> AppException.badRequest(
                        "No promotion cycle found for this assignee. Create a promotion_cycles row for the user first."));
    }

    public record PromotionAssignmentInsert(
            UUID userId, UUID departmentId, UUID promotionCycleId) {}
}
