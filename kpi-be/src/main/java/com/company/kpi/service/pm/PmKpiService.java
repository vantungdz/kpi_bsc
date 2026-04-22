package com.company.kpi.service.pm;

import com.company.kpi.request.pm.ApproveSheetRequest;
import com.company.kpi.request.pm.PmScoreRequest;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.company.kpi.response.pm.PmKpiDashboardResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PmKpiService {

    public PmKpiDashboardResponse getDashboard(Integer year) {
        throw new UnsupportedOperationException("PmKpiService.getDashboard() not yet implemented.");
    }

    public KpiSheetResponse scoreItem(UUID memberId, UUID itemId, PmScoreRequest request) {
        throw new UnsupportedOperationException("PmKpiService.scoreItem() not yet implemented.");
    }

    public void approveSheet(UUID memberId, ApproveSheetRequest request) {
        throw new UnsupportedOperationException("PmKpiService.approveSheet() not yet implemented.");
    }
}
