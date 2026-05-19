package com.company.kpi.service.gm;

import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.gm.GmKpiCycleOptionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GmKpiCycleService {

    private final KpiCycleMapper kpiCycleMapper;

    public List<GmKpiCycleOptionResponse> listCyclesWithKpisInformation() {
        return kpiCycleMapper.listActiveCyclesWithKpisInformation();
    }

    /**
     * Dropdown «Evaluation year» (form tạo KPI): mọi chu kỳ trong {@code kpi_cycles}
     * có {@code year >= năm hiện tại}, kể cả chưa có dữ liệu KPI.
     * <p>Chu kỳ có KPI (năm trước) chỉ dùng cho dropdown sao chép — {@link #listCyclesWithKpisInformation()}.</p>
     */
    public List<GmKpiCycleOptionResponse> listCyclesForEvaluationFromCurrentYear() {
        int currentYear = LocalDate.now().getYear();
        List<GmKpiCycleOptionResponse> rows = new ArrayList<>(
                kpiCycleMapper.listCyclesFromMinYear(currentYear));
        rows.sort(Comparator.comparing(GmKpiCycleOptionResponse::getYear).reversed());
        return rows;
    }
}
