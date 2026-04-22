package com.company.kpi.controller.auth;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.auth.LoginRequest;
import com.company.kpi.request.auth.RefreshTokenRequest;
import com.company.kpi.response.auth.LoginResponse;
import com.company.kpi.response.auth.TokenResponse;
import com.company.kpi.service.auth.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AUTH-001  POST /api/v1/auth/login
 * AUTH-002  POST /api/v1/auth/refresh
 * AUTH-003  POST /api/v1/auth/logout
 */
@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController extends BaseController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<BaseResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        return success(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<BaseResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {
        return success(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<BaseResponse<Void>> logout(
            @Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request);
        return success(null, "Logged out successfully");
    }
}
