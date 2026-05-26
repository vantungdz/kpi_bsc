package com.company.kpi.service.common;

import com.company.kpi.aggregate.AssigneeAssignmentEditRow;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.request.common.AssigneeTargetScaleUpdateRequest;
import com.company.kpi.response.common.AssigneeTargetScaleUpdateResponse;
import com.company.kpi.service.kpi.KpiScoringRulesService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * PM / Leader / Member chỉnh {@code target_value} và {@code scoring_scale} trên assignment của mình
 * khi GM bật {@code allow_assignee_target_scale_edit}.
 */
@Service
@RequiredArgsConstructor
public class AssigneeTargetScaleService {

    private static final int ASM_PENDING_ACCEPTANCE = 404;
    private static final int ASM_ACCEPTED = 405;
    private static final int ASM_REJECTED = 406;
    private static final int ASM_FEEDBACK_IN_PROGRESS = 407;

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiScoringRulesService kpiScoringRulesService;

    @Transactional
    public AssigneeTargetScaleUpdateResponse updateAssigneeTargetAndScale(
            UUID assignmentId,
            UUID assigneeUserId,
            AssigneeTargetScaleUpdateRequest request) {
        AssigneeAssignmentEditRow ctx =
                kpiAssignmentMapper.selectAssigneeEditContext(assignmentId, assigneeUserId);
        if (ctx == null) {
            throw AppException.notFound("Assignment not found");
        }
        if (!Boolean.TRUE.equals(ctx.getAllowAssigneeTargetScaleEdit())) {
            throw AppException.forbidden("This KPI does not allow editing target or scoring scale.");
        }
        int status = ctx.getStatusCode() != null ? ctx.getStatusCode() : 0;
        if (status != ASM_PENDING_ACCEPTANCE
                && status != ASM_ACCEPTED
                && status != ASM_REJECTED
                && status != ASM_FEEDBACK_IN_PROGRESS) {
            throw AppException.badRequest(
                    "Target and scoring scale can only be edited before evaluation submission.");
        }
        BigDecimal targetValue = request.getTargetValue();
        if (targetValue == null || targetValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw AppException.badRequest("targetValue must be greater than 0");
        }
        String scoringJson = kpiScoringRulesService.serializeForPersistence(request.getTargetDescription());

        if (ctx.getAssigneeEditBaselineTarget() == null) {
            kpiAssignmentMapper.captureAssigneeEditBaselineIfAbsent(
                    assignmentId,
                    ctx.getCycleId(),
                    assigneeUserId,
                    ctx.getTargetValue(),
                    ctx.getScoringScale(),
                    assigneeUserId);
        }

        int n = kpiAssignmentMapper.updateAssigneeTargetAndScale(
                assignmentId,
                ctx.getCycleId(),
                assigneeUserId,
                targetValue,
                scoringJson,
                assigneeUserId);
        if (n == 0) {
            throw AppException.badRequest("Could not update assignment");
        }
        return AssigneeTargetScaleUpdateResponse.builder()
                .assignmentId(assignmentId.toString())
                .assignmentTargetValue(targetValue)
                .targetDescription(scoringJson)
                .build();
    }
}
