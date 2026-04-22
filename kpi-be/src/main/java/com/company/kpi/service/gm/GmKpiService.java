package com.company.kpi.service.gm;

import com.company.kpi.response.gm.GmKpiDashboardResponse;
import com.company.kpi.response.gm.KpiSectionMemberResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * GmKpiService — GM KPI dashboard và section details.
 *
 * TODO: Implement với KpiPeriodMapper, KpiSheetMapper, UserMapper, SectionMapper
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GmKpiService {

    public GmKpiDashboardResponse getDashboard(Integer year) {
        int targetYear = (year != null) ? year : java.time.Year.now().getValue();
        // TODO: query database and build response
        throw new UnsupportedOperationException("GmKpiService.getDashboard() not yet implemented. Use mock mode.");
    }

    public List<KpiSectionMemberResponse> getSectionMembers(UUID sectionId, Integer year) {
        // TODO: query database
        throw new UnsupportedOperationException("GmKpiService.getSectionMembers() not yet implemented.");
    }
}
