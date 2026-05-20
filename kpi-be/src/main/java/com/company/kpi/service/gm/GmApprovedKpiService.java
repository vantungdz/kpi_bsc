package com.company.kpi.service.gm;

import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.request.gm.GmApprovedKpiDecisionRequest;
import com.company.kpi.request.gm.GmFeedbackSplitKpiRequest;
import com.company.kpi.response.gm.GmApprovedKpiDecisionResponse;
import com.company.kpi.response.gm.GmApprovedKpiQueueItemResponse;
import com.company.kpi.service.kpi.StrategicKpiService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GmApprovedKpiService {

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final StrategicKpiService strategicKpiService;

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
            // Từ chối feedback: 407→404, không bắt buộc lý do (khác từ chối KPI 403→406).
            String updateReason = "";
            int nReset = kpiAssignmentMapper.updateAssignmentStatusFromFeedbackToPendingAcceptance(
                    req.getAssignmentId(), cycleId, gmUserId, updateReason);
            if (nReset != 1) {
                throw AppException.badRequest(
                        "Không thể cập nhật: feedback không hợp lệ hoặc assignment không ở trạng thái feedback in progress.");
            }
            updatedCount = 1;
        } else {
            Integer currentStatus = kpiAssignmentMapper.findAssignmentStatusCode(req.getAssignmentId(), cycleId);
            if (currentStatus != null && currentStatus == Constants.AssignStatus.FEEDBACK_IN_PROGRESS) {
                throw AppException.badRequest(
                        "KPI đang ở trạng thái feedback nhưng không có feedback chờ GM. "
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
                    throw AppException.badRequest("Please enter a rejection reason.");
                }
                updateReason = rr;
            }
            int n = kpiAssignmentMapper.updateGmAssignmentStatusFromWaitingGm(
                    req.getAssignmentId(), cycleId, newStatus, gmUserId, updateReason);
            if (n != 1) {
                throw AppException.badRequest(
                        "Không thể cập nhật: assignment không tồn tại, sai chu kỳ, hoặc không ở trạng thái chờ GM duyệt mới.");
            }
            
            if (newStatus == Constants.AssignStatus.ACCEPTED) {
                kpiAssignmentMapper.activateSelfAssignedPmChildAssignments(req.getAssignmentId(), cycleId, gmUserId);
            } else if (newStatus == Constants.AssignStatus.REJECTED) {
                kpiAssignmentMapper.cascadeActivateChildAssignments(req.getAssignmentId(), cycleId, Constants.AssignStatus.REJECTED, gmUserId);
            }
            
            updatedCount = n;
        }
        GmApprovedKpiDecisionResponse out = new GmApprovedKpiDecisionResponse();
        out.setUpdatedCount(updatedCount);
        return out;
    }

    @Transactional
    public GmApprovedKpiDecisionResponse splitFeedbackAssigneeToNewKpi(GmFeedbackSplitKpiRequest req, UUID gmUserId) {
        UUID cycleId = req.getCycleId();
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        KpiAssignmentUserTargetRow feedbackAssignment =
                kpiAssignmentMapper.findAssignmentUserTargetByIdAndCycle(req.getFeedbackAssignmentId(), cycleId);
        if (feedbackAssignment == null || feedbackAssignment.getUserId() == null) {
            throw AppException.notFound("Feedback assignment not found: " + req.getFeedbackAssignmentId());
        }
        if (!Objects.equals(feedbackAssignment.getStatusCode(), Constants.AssignStatus.FEEDBACK_IN_PROGRESS)) {
            throw AppException.badRequest("Feedback assignment is not at feedback in progress.");
        }
        if (feedbackAssignment.getKpiTypeCode() == null
                || (feedbackAssignment.getKpiTypeCode() != 101 && feedbackAssignment.getKpiTypeCode() != 103)) {
            throw AppException.badRequest("Only Individual or Promotion feedback can be split into a new KPI.");
        }

        var newKpi = req.getNewKpi();
        if (newKpi == null || newKpi.getTypeCode() == null
                || (newKpi.getTypeCode() != 101 && newKpi.getTypeCode() != 103)) {
            throw AppException.badRequest("Only Individual or Promotion feedback can be split into a new KPI.");
        }
        if (!Objects.equals(feedbackAssignment.getKpiTypeCode(), newKpi.getTypeCode())) {
            throw AppException.badRequest("New KPI type must match the feedback KPI type.");
        }
        if (newKpi.getMemberIds() == null
                || newKpi.getMemberIds().size() != 1
                || !feedbackAssignment.getUserId().equals(newKpi.getMemberIds().get(0))) {
            throw AppException.badRequest("New KPI must be assigned only to the member who sent feedback.");
        }
        if (!cycleId.equals(newKpi.getCycleId())) {
            throw AppException.badRequest("New KPI cycleId must match the feedback cycle.");
        }

        strategicKpiService.create(newKpi, gmUserId, "");

        int nFeedback = kpiAssignmentMapper.resolveActiveGmFeedback(
                req.getFeedbackAssignmentId(), cycleId, gmUserId);
        if (nFeedback < 1) {
            throw AppException.badRequest("Feedback is not pending GM review or has already been resolved.");
        }

        int nDelete = kpiAssignmentMapper.softDeleteKpiAssignmentById(
                req.getFeedbackAssignmentId(), cycleId, gmUserId);
        if (nDelete < 1) {
            throw AppException.badRequest("Could not remove the original feedback assignment.");
        }

        GmApprovedKpiDecisionResponse out = new GmApprovedKpiDecisionResponse();
        out.setUpdatedCount(1);
        return out;
    }
}
