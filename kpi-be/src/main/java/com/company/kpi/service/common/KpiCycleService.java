package com.company.kpi.service.common;

import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.common.KpiCycleResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class KpiCycleService {

    private final KpiCycleMapper kpiCycleMapper;
    private final ModelMapper modelMapper;

    public KpiCycleResponse getKpiCycleByYear(Integer year) {
        Optional<KpiCycle> optionalKpiCycle = kpiCycleMapper.findByYear(year);

        if (optionalKpiCycle.isEmpty()) {
            log.warn("KPI Cycle not found for year: {}", year);
            throw AppException.notFound("KPI Cycle not found for year: " + year);
        }

        KpiCycle kpiCycle = optionalKpiCycle.get();
        KpiCycleResponse response = modelMapper.map(kpiCycle, KpiCycleResponse.class);
        String activePhase = calculateActivePhase(
                kpiCycle.getGoalSettingDeadline(),
                kpiCycle.getMidYearDeadline()
        );
        response.setActivePhase(activePhase);

        return response;
    }

    private String calculateActivePhase(OffsetDateTime goalDeadline, OffsetDateTime midDeadline) {
        OffsetDateTime now = OffsetDateTime.now();

        if (midDeadline != null && now.isAfter(midDeadline)) {
            return Constant.END_YEAR_PHASE;
        } else if (goalDeadline != null && now.isAfter(goalDeadline)) {
            return Constant.MID_YEAR_PHASE;
        } else {
            return Constant.TARGET_SETUP_PHASE;
        }
    }
}