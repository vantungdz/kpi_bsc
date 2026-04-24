package com.company.kpi.mapper;

import com.company.kpi.entity.KpiCycle;
import com.company.kpi.response.gm.GmKpiCycleOptionResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Mapper
public interface KpiCycleMapper {

    Optional<KpiCycle> findByYear(int year);

    Optional<KpiCycle> findById(@Param("id") UUID id);
    /** Chu kỳ đang hoạt động và đã có ít nhất một KPI áp dụng trong {@code kpis_information}. */
    List<GmKpiCycleOptionResponse> listActiveCyclesWithKpisInformation();

    /** Chu kỳ chưa xóa mềm, {@code year >= minYear} — dropdown năm đánh giá (không lấy năm quá khứ). */
    List<GmKpiCycleOptionResponse> listCyclesFromMinYear(@Param("minYear") int minYear);
    KpiCycle findActiveCycle(@Param("statusCode") Integer statusCode);

    List<KpiCycle> getCycles();
}
