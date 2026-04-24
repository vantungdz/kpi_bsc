package com.company.kpi.controller.pm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.pm.KpiRegistrationRequest;
import com.company.kpi.response.pm.KpiRegistrationInitResponse;
import com.company.kpi.service.pm.KpiRegistrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/v1/kpi/pm")
@RequiredArgsConstructor
public class PmKpiController extends BaseController {

    private final KpiRegistrationService kpiRegistrationService;
    private final com.company.kpi.common.util.JwtUtil jwtUtil;

    @GetMapping("/registration/init")
    public ResponseEntity<BaseResponse<KpiRegistrationInitResponse>> getRegistrationInitData(
            Authentication authentication) {
        UUID userId = jwtUtil.resolveUserId(authentication);
        return success(kpiRegistrationService.getInitData(userId));
    }

    @PostMapping("/registration")
    public ResponseEntity<Void> registerKpi(
            @RequestBody KpiRegistrationRequest request,
            Authentication authentication) {
        UUID userId = jwtUtil.resolveUserId(authentication);
        kpiRegistrationService.registerKpi(request, userId);
        return ResponseEntity.ok().build();
    }
}
