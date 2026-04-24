package com.company.kpi.mapper;

import com.company.kpi.response.gm.GmKpiCategoryResponse;
import com.company.kpi.entity.KpiCategory;
import com.company.kpi.response.member.KpiCategoryOption;
import com.company.kpi.response.member.KpiCategoryOption;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Mapper
public interface KpiCategoryMapper {

    List<KpiCategory> findAll();
    List<GmKpiCategoryResponse> listAllActive();

    int countActiveById(UUID id);

    Optional<GmKpiCategoryResponse> findActiveById(UUID id);

    List<KpiCategoryOption> listKpiCategories();
}
