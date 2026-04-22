package com.company.kpi.service.leader;

import com.company.kpi.request.leader.LeaderScoreRequest;
import com.company.kpi.response.pm.KpiSheetResponse;
import com.company.kpi.response.leader.LeaderKpiDashboardResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeaderKpiService {

    public LeaderKpiDashboardResponse getDashboard(Integer year) {
        throw new UnsupportedOperationException("LeaderKpiService.getDashboard() not yet implemented.");
    }

    public KpiSheetResponse scoreItem(UUID memberId, UUID itemId, LeaderScoreRequest request) {
        throw new UnsupportedOperationException("LeaderKpiService.scoreItem() not yet implemented.");
    }
}
