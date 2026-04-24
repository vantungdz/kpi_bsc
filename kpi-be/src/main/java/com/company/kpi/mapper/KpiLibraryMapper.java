package com.company.kpi.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * README Flow 3: ghi {@code kpi_master}, {@code kpis_information} — đồng bộ {@code document/db/init-db.sql}.
 */
@Mapper
public interface KpiLibraryMapper {

    int insertKpiMaster(
            @Param("id") UUID id,
            @Param("code") String code,
            @Param("name") String name,
            @Param("categoryId") UUID categoryId,
            @Param("typeCode") int typeCode,
            @Param("calcRuleCode") int calcRuleCode,
            @Param("calcTypeCode") Integer calcTypeCode,
            @Param("unitCode") Integer unitCode,
            @Param("isGlobal") boolean isGlobal,
            @Param("createdBy") UUID createdBy);

    int insertKpisInformation(
            @Param("id") UUID id,
            @Param("cycleId") UUID cycleId,
            @Param("masterKpiId") UUID masterKpiId,
            @Param("targetDescription") String targetDescription,
            @Param("targetValue") BigDecimal targetValue,
            @Param("weight") BigDecimal weight,
            @Param("isImportant") boolean isImportant,
            @Param("createdBy") UUID createdBy);

    int insertMemberKpiAssignment(
            @Param("id") UUID id,
            @Param("cycleId") UUID cycleId,
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("userId") UUID userId,
            @Param("jobTitleId") UUID jobTitleId,
            @Param("targetValue") BigDecimal targetValue,
            @Param("statusCode") int statusCode,
            @Param("createdBy") UUID createdBy);
}
