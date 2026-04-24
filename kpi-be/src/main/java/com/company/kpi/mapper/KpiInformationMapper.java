package com.company.kpi.mapper;

import com.company.kpi.response.gm.GmKpiCatalogItemResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface KpiInformationMapper {

    List<GmKpiCatalogItemResponse> listCatalogByCycleId(@Param("cycleId") UUID cycleId);
}
