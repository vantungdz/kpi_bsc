package com.company.kpi.controller.pm;

import com.company.kpi.response.pm.PmDashboardResponse;
import com.company.kpi.service.pm.PmDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.common.util.JwtUtil;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.common.Constants;
import com.company.kpi.common.dto.BaseResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/v1/pm/dashboard")
@RequiredArgsConstructor
public class PmDashboardController extends BaseController {

    private final PmDashboardService pmDashboardService;
    private final JwtUtil jwtUtil;

    @GetMapping("/init")
    public ResponseEntity<BaseResponse<PmDashboardResponse>> initDashboard(
            @RequestParam("year") Integer year,
            Authentication authentication
    ) {
        UUID pmId = jwtUtil.resolveUserId(authentication);
        PmDashboardResponse response = pmDashboardService.getDashboardInitialization(pmId, year);
        return success(response);
    }
}