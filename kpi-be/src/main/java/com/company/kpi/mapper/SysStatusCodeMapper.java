package com.company.kpi.mapper;

import com.company.kpi.entity.SysStatusCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import com.company.kpi.response.reference.KpiTypeOptionResponse;
import com.company.kpi.response.member.CalcRuleOption;
import com.company.kpi.response.reference.KpiUnitOptionResponse;
import com.company.kpi.response.reference.StatusCodeOptionResponse;

import java.util.List;

@Mapper
public interface SysStatusCodeMapper {
    List<SysStatusCode> findByCategories(@Param("categories") List<String> categories);
    
    List<KpiUnitOptionResponse> listKpiUnits(@Param("category") String category);

    List<StatusCodeOptionResponse> listCalcRuleOptions();

    List<StatusCodeOptionResponse> listCalcTypeOptions();

    /** {@code KPI_TYPE} (101–103) — thứ tự hiển thị: TEAM, INDIVIDUAL, PROMOTION. */
    List<KpiTypeOptionResponse> listStrategicKpiTypes();

    List<CalcRuleOption> listCalcRules801To804();
}
