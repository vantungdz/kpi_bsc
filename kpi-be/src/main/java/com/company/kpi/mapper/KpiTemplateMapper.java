package com.company.kpi.mapper;

import com.company.kpi.aggregate.KpiTemplateEntityRow;
import com.company.kpi.aggregate.KpiTemplateItemEditRow;
import com.company.kpi.response.gm.GmKpiTemplateItemResponse;
import com.company.kpi.response.gm.GmKpiTemplatePackageResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Mapper
public interface KpiTemplateMapper {

    List<GmKpiTemplatePackageResponse> listActiveTemplates();

    int countActiveTemplateById(@Param("id") UUID id);

    List<GmKpiTemplateItemResponse> listItemsByTemplateId(
            @Param("templateId") UUID templateId, @Param("year") int year);

    KpiTemplateEntityRow selectActiveTemplateEntityById(@Param("id") UUID id);

    int insertTemplate(
            @Param("id") UUID id,
            @Param("name") String name,
            @Param("description") String description,
            @Param("jobFamilyId") UUID jobFamilyId,
            @Param("rankId") UUID rankId);

    int updateTemplate(
            @Param("id") UUID id,
            @Param("name") String name,
            @Param("description") String description,
            @Param("jobFamilyId") UUID jobFamilyId,
            @Param("rankId") UUID rankId);

    int softDeleteTemplateById(@Param("id") UUID id);

    List<UUID> listDistinctMasterIdsByTemplateId(@Param("templateId") UUID templateId);

    int deleteTemplateItemsByTemplateId(@Param("templateId") UUID templateId);

    int insertTemplateItem(
            @Param("id") UUID id,
            @Param("templateId") UUID templateId,
            @Param("masterKpiId") UUID masterKpiId,
            @Param("defaultTargetDescription") String defaultTargetDescription,
            @Param("defaultTargetValue") BigDecimal defaultTargetValue,
            @Param("defaultWeight") BigDecimal defaultWeight);

    KpiTemplateItemEditRow selectTemplateItemEditRow(
            @Param("templateId") UUID templateId, @Param("itemId") UUID itemId);

    GmKpiTemplateItemResponse selectTemplateItemResponse(
            @Param("templateId") UUID templateId, @Param("itemId") UUID itemId, @Param("year") int year);

    int updateTemplateItemDefaults(
            @Param("templateId") UUID templateId,
            @Param("itemId") UUID itemId,
            @Param("defaultTargetDescription") String defaultTargetDescription,
            @Param("defaultTargetValue") BigDecimal defaultTargetValue,
            @Param("defaultWeight") BigDecimal defaultWeight);

    int deleteTemplateItemByTemplateAndId(@Param("templateId") UUID templateId, @Param("itemId") UUID itemId);

    int countActiveTemplateItemsByMasterKpiId(@Param("masterKpiId") UUID masterKpiId);

    int countActiveJobFamilyById(@Param("id") UUID id);

    int countActiveRankById(@Param("id") UUID id);
}

