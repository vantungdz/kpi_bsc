package com.company.kpi.mapper;

import com.company.kpi.aggregate.KpiInfoForDeleteRow;
import com.company.kpi.aggregate.KpiStrategicEditMasterRow;
import com.company.kpi.entity.KpisInformation;
import com.company.kpi.response.gm.GmDiagnosticsFlatRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Mapper
public interface KpisInformationMapper {

    int insert(KpisInformation kpisInformation);

    KpisInformation findByCycleAndMaster(
            @Param("cycleId") UUID cycleId,
            @Param("masterKpiId") UUID masterKpiId);

    void insertKpisInformation(
            @Param("id") UUID id,
            @Param("cycleId") UUID cycleId,
            @Param("masterKpiId") UUID masterKpiId,
            @Param("targetDescription") String targetDescription,
            @Param("targetValue") BigDecimal targetValue,
            @Param("weight") BigDecimal weight,
            @Param("isImportant") boolean isImportant,
            @Param("createdBy") UUID createdBy);

    KpiInfoForDeleteRow selectKpiInfoForDelete(@Param("kpiInfoId") UUID kpiInfoId);

    KpiInfoForDeleteRow selectSelfCreatedKpiInfoForPmDelete(
            @Param("assignmentId") UUID assignmentId,
            @Param("pmId") UUID pmId);

    int softDeleteKpisInformationById(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("updatedBy") UUID updatedBy);

    int countActiveKpisInformationByMasterKpiId(@Param("masterKpiId") UUID masterKpiId);

    KpiStrategicEditMasterRow selectStrategicKpiEditMaster(@Param("kpiInfoId") UUID kpiInfoId);

    int updateKpisInformationStrategic(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("targetDescription") String targetDescription,
            @Param("targetValue") BigDecimal targetValue,
            @Param("weight") BigDecimal weight,
            @Param("isImportant") boolean isImportant,
            @Param("updatedBy") UUID updatedBy);

    List<GmDiagnosticsFlatRow> listDiagnosticsFlatByCycleId(@Param("cycleId") UUID cycleId);
}
