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

    /** Admin: toàn bộ chu kỳ chưa xóa mềm, mới nhất trước. */
    List<KpiCycle> selectAllCyclesForAdmin();

    int insertKpiCycle(
            @Param("id") UUID id,
            @Param("year") Integer year,
            @Param("name") String name,
            @Param("goalSettingStartDate") String goalSettingStartDate,
            @Param("goalSettingEndDate") String goalSettingEndDate,
            @Param("midYearStartDate") String midYearStartDate,
            @Param("midYearEndDate") String midYearEndDate,
            @Param("endYearStartDate") String endYearStartDate,
            @Param("endYearEndDate") String endYearEndDate,
            @Param("statusCode") Integer statusCode,
            @Param("createdBy") UUID createdBy,
            @Param("updatedBy") UUID updatedBy);

    int updateCycleStatus(
            @Param("id") UUID id,
            @Param("statusCode") int statusCode,
            @Param("updatedBy") UUID updatedBy);

    /** Số chu kỳ đang OPEN (201), chưa xóa mềm. */
    int countOpenCycles();

    /**
     * Số chu kỳ OPEN (201) khác {@code excludeId}.
     * Dùng khi mở một kỳ: nếu &gt; 0 thì đã có năm khác đang mở.
     */
    int countOtherOpenCycles(@Param("excludeId") UUID excludeId);

    int updateCyclePhaseDates(
            @Param("id") UUID id,
            @Param("phase") String phase,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("updatedBy") UUID updatedBy);
}
