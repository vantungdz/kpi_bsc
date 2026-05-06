package com.company.kpi.service.gm;

import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.request.gm.GmApprovedKpiDecisionRequest;
import com.company.kpi.response.gm.GmApprovedKpiDecisionResponse;
import com.company.kpi.response.gm.GmApprovedKpiQueueItemResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GmApprovedKpiService {

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    public List<GmApprovedKpiQueueItemResponse> listQueue(UUID cycleId) {
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));
        return kpiAssignmentMapper.listGmApprovedKpiQueue(cycleId);
    }

    @Transactional
    public GmApprovedKpiDecisionResponse decide(GmApprovedKpiDecisionRequest req, UUID gmUserId) {
        UUID cycleId = req.getCycleId();
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        int updatedCount = 0;
        int nFeedback = kpiAssignmentMapper.resolveActiveGmFeedback(req.getAssignmentId(), cycleId, gmUserId);
        if (nFeedback > 0) {
            int nReset = kpiAssignmentMapper.updateAssignmentStatusFromFeedbackToPendingAcceptance(
                    req.getAssignmentId(), cycleId, gmUserId);
            if (nReset != 1) {
                throw AppException.badRequest(
                        "Không thể cập nhật: feedback không hợp lệ hoặc assignment không ở trạng thái 407.");
            }
            updatedCount = 1;
        } else {
            int newStatus = Boolean.TRUE.equals(req.getApprove())
                    ? Constants.AssignStatus.ACCEPTED
                    : Constants.AssignStatus.REJECTED;
            int n = kpiAssignmentMapper.updateGmAssignmentStatusFromWaitingGm(
                    req.getAssignmentId(), cycleId, newStatus, gmUserId);
            if (n != 1) {
                throw AppException.badRequest(
                        "Không thể cập nhật: assignment không tồn tại, sai chu kỳ, hoặc không ở trạng thái chờ GM (403/407).");
            }
            updatedCount = n;
        }
        GmApprovedKpiDecisionResponse out = new GmApprovedKpiDecisionResponse();
        out.setUpdatedCount(updatedCount);
        return out;
    }
}
