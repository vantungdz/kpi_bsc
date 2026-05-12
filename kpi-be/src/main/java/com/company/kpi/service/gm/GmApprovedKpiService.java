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
            Integer currentStatus = kpiAssignmentMapper.findAssignmentStatusCode(req.getAssignmentId(), cycleId);
            if (currentStatus != null && currentStatus == Constants.AssignStatus.FEEDBACK_IN_PROGRESS) {
                throw AppException.badRequest(
                        "KPI đang ở trạng thái feedback (407) nhưng không có feedback chờ GM. "
                                + "Nếu feedback dành cho PM, GM xử lý từ tab Strategic; nếu đã xử lý, hãy làm mới danh sách.");
            }
            int newStatus = Boolean.TRUE.equals(req.getApprove())
                    ? Constants.AssignStatus.ACCEPTED
                    : Constants.AssignStatus.REJECTED;
            String updateReason;
            if (Boolean.TRUE.equals(req.getApprove())) {
                updateReason = "";
            } else {
                String rr = req.getRejectReason() != null ? req.getRejectReason().trim() : "";
                if (rr.isEmpty()) {
                    throw AppException.badRequest("Vui lòng nhập lý do từ chối.");
                }
                updateReason = rr;
            }
            int n = kpiAssignmentMapper.updateGmAssignmentStatusFromWaitingGm(
                    req.getAssignmentId(), cycleId, newStatus, gmUserId, updateReason);
            if (n != 1) {
                throw AppException.badRequest(
                        "Không thể cập nhật: assignment không tồn tại, sai chu kỳ, hoặc không ở trạng thái chờ GM duyệt mới.");
            }
            
            // Cascade status to child assignments
            if (newStatus == Constants.AssignStatus.ACCEPTED) {
                // Activate child assignments (401 -> 404 PENDING_ACCEPTANCE)
                kpiAssignmentMapper.cascadeActivateChildAssignments(req.getAssignmentId(), cycleId, Constants.AssignStatus.PENDING_ACCEPTANCE, gmUserId);
            } else if (newStatus == Constants.AssignStatus.REJECTED) {
                // Reject child assignments (401 -> 406 REJECTED)
                kpiAssignmentMapper.cascadeActivateChildAssignments(req.getAssignmentId(), cycleId, Constants.AssignStatus.REJECTED, gmUserId);
            }
            
            updatedCount = n;
        }
        GmApprovedKpiDecisionResponse out = new GmApprovedKpiDecisionResponse();
        out.setUpdatedCount(updatedCount);
        return out;
    }
}
