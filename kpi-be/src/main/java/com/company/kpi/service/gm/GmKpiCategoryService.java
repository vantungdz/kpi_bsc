package com.company.kpi.service.gm;

import com.company.kpi.mapper.KpiCategoryMapper;
import com.company.kpi.response.gm.GmKpiCategoryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GmKpiCategoryService {

    private final KpiCategoryMapper kpiCategoryMapper;

    public List<GmKpiCategoryResponse> listActiveCategories() {
        return kpiCategoryMapper.listAllActive();
    }
}
