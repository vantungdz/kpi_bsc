package com.company.kpi.service.gm;

import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.gm.GmKpiCycleOptionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Year;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GmKpiCycleService {

    private final KpiCycleMapper kpiCycleMapper;

    public List<GmKpiCycleOptionResponse> listCyclesWithKpisInformation() {
        return kpiCycleMapper.listActiveCyclesWithKpisInformation();
    }

    /**
     * Chu kỳ có {@code year} ≥ năm dương lịch hiện tại (theo máy chủ) — form «Năm đánh giá» / header GM.
     */
    public List<GmKpiCycleOptionResponse> listCyclesForEvaluationFromCurrentYear() {
        return kpiCycleMapper.listCyclesFromMinYear(Year.now().getValue());
    }
}
