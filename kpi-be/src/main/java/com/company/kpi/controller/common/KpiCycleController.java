package com.company.kpi.controller.common;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.response.common.KpiCycleResponse;
import com.company.kpi.response.gm.GmKpiCycleOptionResponse;
import com.company.kpi.service.common.KpiCycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/common/kpi-cycles")
@RequiredArgsConstructor
public class KpiCycleController extends BaseController {

    private final KpiCycleService kpiCycleService;

    @GetMapping
    public ResponseEntity<BaseResponse<List<GmKpiCycleOptionResponse>>> listKpiCyclesForDropdown() {
        return success(kpiCycleService.listKpiCyclesForDropdown());
    }

    @GetMapping("/{year}")
    public ResponseEntity<BaseResponse<KpiCycleResponse>> getKpiCycleByYear(
            @PathVariable("year") Integer year) {
        return success(kpiCycleService.getKpiCycleByYear(year));
    }
}