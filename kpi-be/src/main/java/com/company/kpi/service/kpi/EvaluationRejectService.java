package com.company.kpi.service.kpi;

import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.request.evaluation.EvaluationRejectRequest;
import com.company.kpi.response.evaluation.EvaluationRejectResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EvaluationRejectService {

    private static final int ASM_FIRST_COMPLETED = 503;

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    @Transactional
    public EvaluationRejectResponse rejectForPm(EvaluationRejectRequest req, UUID pmId) {
        return reject(req, pmId, true);
    }

    @Transactional
    public EvaluationRejectResponse rejectForGm(EvaluationRejectRequest req, UUID gmUserId) {
        return reject(req, gmUserId, false);
    }

    private EvaluationRejectResponse reject(
            EvaluationRejectRequest req, UUID actorId, boolean pmScoped) {
        UUID cycleId = req.getCycleId();
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        UUID memberId = req.getEvaluationUserId();
        if (memberId == null) {
            throw AppException.badRequest("evaluationUserId is required.");
        }
        String rejectReason = normalizeRejectReason(req.getRejectReason());

        boolean promotion = Boolean.TRUE.equals(req.getPromotion());
        boolean rejectAll = Boolean.TRUE.equals(req.getRejectAll());

        int updated;
        if (rejectAll) {
            updated = pmScoped
                    ? rejectAllForPm(actorId, cycleId, memberId, promotion, rejectReason)
                    : rejectAllForGm(cycleId, memberId, promotion, actorId, rejectReason);
            if (updated <= 0) {
                throw AppException.badRequest(
                        "No KPIs in a rejectable evaluation status were found.");
            }
        } else {
            UUID assignmentId = req.getAssignmentId();
            if (assignmentId == null) {
                throw AppException.badRequest("assignmentId is required when rejectAll is false.");
            }
            Integer st = pmScoped
                    ? kpiAssignmentMapper.selectPmManagedMemberAssignmentStatus(
                            assignmentId, cycleId, memberId, actorId)
                    : kpiAssignmentMapper.selectGmEvaluationAssignmentStatus(
                            assignmentId, cycleId, memberId);
            if (st == null) {
                throw AppException.badRequest(
                        "Assignment not found or not in this evaluation scope.");
            }
            updated = rejectSingle(
                    assignmentId, cycleId, memberId, promotion, st, actorId, pmScoped, rejectReason);
        }

        EvaluationRejectResponse out = new EvaluationRejectResponse();
        out.setUpdatedCount(updated);
        return out;
    }

    private static String normalizeRejectReason(String raw) {
        if (raw == null) {
            throw AppException.badRequest("Reject reason is required.");
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            throw AppException.badRequest("Reject reason is required.");
        }
        return trimmed;
    }

    private int rejectAllForPm(
            UUID pmId, UUID cycleId, UUID memberId, boolean promotion, String rejectReason) {
        int updated = 0;
        updated += kpiAssignmentMapper.updateKpiStatusesForPmManagedMemberSingle(
                pmId, cycleId, memberId, Constants.AssignStatus.FIRST_REJECTED, promotion, 501,
                rejectReason);
        updated += kpiAssignmentMapper.updateKpiStatusesForPmManagedMemberSingle(
                pmId, cycleId, memberId, Constants.AssignStatus.FIRST_REJECTED, promotion, 502,
                rejectReason);
        updated += kpiAssignmentMapper.updateKpiStatusesForPmManagedMemberSingle(
                pmId, cycleId, memberId, Constants.AssignStatus.SECOND_REJECTED, promotion, 601,
                rejectReason);
        updated += kpiAssignmentMapper.updateKpiStatusesForPmManagedMemberSingle(
                pmId, cycleId, memberId, Constants.AssignStatus.SECOND_REJECTED, promotion, 602,
                rejectReason);
        return updated;
    }

    private int rejectAllForGm(
            UUID cycleId, UUID memberId, boolean promotion, UUID gmUserId, String rejectReason) {
        int updated = 0;
        updated += kpiAssignmentMapper.rejectGmEvaluationFromStatus(
                cycleId, memberId, promotion, 501, Constants.AssignStatus.FIRST_REJECTED,
                rejectReason, gmUserId);
        updated += kpiAssignmentMapper.rejectGmEvaluationFromStatus(
                cycleId, memberId, promotion, 502, Constants.AssignStatus.FIRST_REJECTED,
                rejectReason, gmUserId);
        updated += kpiAssignmentMapper.rejectGmEvaluationFromStatus(
                cycleId, memberId, promotion, 601, Constants.AssignStatus.SECOND_REJECTED,
                rejectReason, gmUserId);
        updated += kpiAssignmentMapper.rejectGmEvaluationFromStatus(
                cycleId, memberId, promotion, 602, Constants.AssignStatus.SECOND_REJECTED,
                rejectReason, gmUserId);
        return updated;
    }

    private int rejectSingle(
            UUID assignmentId,
            UUID cycleId,
            UUID memberId,
            boolean promotion,
            int st,
            UUID actorId,
            boolean pmScoped,
            String rejectReason) {
        if (st == 501 || st == 502) {
            int n = pmScoped
                    ? kpiAssignmentMapper.rejectPmEvaluationTarget(
                            assignmentId, cycleId, memberId, actorId,
                            Constants.AssignStatus.FIRST_REJECTED, st, rejectReason, actorId)
                    : kpiAssignmentMapper.rejectGmEvaluationTarget(
                            assignmentId, cycleId, memberId,
                            Constants.AssignStatus.FIRST_REJECTED, st, rejectReason, actorId);
            if (n != 1) {
                throw AppException.badRequest(
                        "KPI is not in a rejectable mid-year status (501/502).");
            }
            int siblings = pmScoped
                    ? kpiAssignmentMapper.rollbackPmEvaluationSiblings(
                            assignmentId, cycleId, memberId, actorId, promotion,
                            Constants.AssignStatus.ACCEPTED, actorId)
                    : kpiAssignmentMapper.rollbackGmEvaluationSiblings(
                            assignmentId, cycleId, memberId, promotion,
                            Constants.AssignStatus.ACCEPTED, actorId);
            return n + siblings;
        }
        if (st == 601 || st == 602) {
            int n = pmScoped
                    ? kpiAssignmentMapper.rejectPmEvaluationTarget(
                            assignmentId, cycleId, memberId, actorId,
                            Constants.AssignStatus.SECOND_REJECTED, st, rejectReason, actorId)
                    : kpiAssignmentMapper.rejectGmEvaluationTarget(
                            assignmentId, cycleId, memberId,
                            Constants.AssignStatus.SECOND_REJECTED, st, rejectReason, actorId);
            if (n != 1) {
                throw AppException.badRequest(
                        "KPI is not in a rejectable year-end status (601/602).");
            }
            int siblings = pmScoped
                    ? kpiAssignmentMapper.rollbackPmEvaluationSiblings(
                            assignmentId, cycleId, memberId, actorId, promotion,
                            ASM_FIRST_COMPLETED, actorId)
                    : kpiAssignmentMapper.rollbackGmEvaluationSiblings(
                            assignmentId, cycleId, memberId, promotion,
                            ASM_FIRST_COMPLETED, actorId);
            return n + siblings;
        }
        throw AppException.badRequest(
                "KPI must be in status 501, 502, 601, or 602 to reject.");
    }
}
