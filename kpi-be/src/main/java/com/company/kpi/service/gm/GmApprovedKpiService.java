package com.company.kpi.service.gm;

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

    private static final int STATUS_PENDING_ACCEPTANCE = 404;
    private static final int STATUS_REJECTED = 406;

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

        int newStatus = Boolean.TRUE.equals(req.getApprove()) ? STATUS_PENDING_ACCEPTANCE : STATUS_REJECTED;
        int n = kpiAssignmentMapper.updateGmAssignmentStatusFromWaitingGm(
                req.getAssignmentId(), cycleId, newStatus, gmUserId);
        if (n != 1) {
            throw AppException.badRequest(
                    "Không thể cập nhật: assignment không tồn tại, sai chu kỳ, hoặc không ở trạng thái chờ GM (403).");
        }
        GmApprovedKpiDecisionResponse out = new GmApprovedKpiDecisionResponse();
        out.setUpdatedCount(n);
        return out;
    }
}
