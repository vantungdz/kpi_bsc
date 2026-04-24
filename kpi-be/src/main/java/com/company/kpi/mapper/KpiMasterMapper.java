package com.company.kpi.mapper;

import com.company.kpi.aggregate.pm.KpiRegistrationInitAggregate;
import com.company.kpi.entity.KpiMaster;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface KpiMasterMapper {

    int insert(KpiMaster kpiMaster);

    List<KpiMaster> findAvailableKpis(@Param("userId") UUID userId);

    void insertKpiMaster(
            @Param("id") UUID id,
            @Param("name") String name,
            @Param("categoryId") UUID categoryId,
            @Param("typeCode") int typeCode,
            @Param("calculationRuleCode") int calculationRuleCode,
            @Param("calculationTypeCode") Integer calculationTypeCode,
            @Param("unitCode") Integer unitCode,
            @Param("isGlobal") boolean isGlobal,
            @Param("createdBy") UUID createdBy);

    int softDeleteKpiMasterById(
            @Param("masterKpiId") UUID masterKpiId,
            @Param("updatedBy") UUID updatedBy);

    int updateKpiMasterStrategic(
            @Param("masterKpiId") UUID masterKpiId,
            @Param("name") String name,
            @Param("categoryId") UUID categoryId,
            @Param("typeCode") int typeCode,
            @Param("calculationRuleCode") int calculationRuleCode,
            @Param("calculationTypeCode") Integer calculationTypeCode,
            @Param("unitCode") Integer unitCode,
            @Param("updatedBy") UUID updatedBy);
}

