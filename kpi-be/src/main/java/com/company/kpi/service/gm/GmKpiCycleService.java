package com.company.kpi.service.gm;

import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.gm.GmKpiCycleOptionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GmKpiCycleService {

    private final KpiCycleMapper kpiCycleMapper;

    public List<GmKpiCycleOptionResponse> listCyclesWithKpisInformation() {
        return kpiCycleMapper.listActiveCyclesWithKpisInformation();
    }

    /**
     * Chu kỳ đã có dữ liệu KPI (thư viện, giao việc hoặc chốt sổ) — dropdown «Năm» header GM / đánh giá.
     * Bao gồm các năm trước để GM xem lịch sử (năm &lt; hiện tại → read-only ở FE).
     */
    public List<GmKpiCycleOptionResponse> listCyclesForEvaluationFromCurrentYear() {
        return kpiCycleMapper.listActiveCyclesWithKpisInformation();
    }
}
