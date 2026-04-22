package com.company.kpi.service.auth;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.common.util.JwtUtil;
import com.company.kpi.entity.RefreshToken;
import com.company.kpi.entity.User;
import com.company.kpi.mapper.RefreshTokenMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.auth.LoginRequest;
import com.company.kpi.request.auth.RefreshTokenRequest;
import com.company.kpi.response.auth.LoginResponse;
import com.company.kpi.response.auth.TokenResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final RefreshTokenMapper refreshTokenMapper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public LoginResponse login(LoginRequest request) {
        User user = userMapper.findByEmail(request.getEmail());
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw AppException.unauthorized("Email hoặc mật khẩu không đúng");
        }

        String accessToken = jwtUtil.generateAccessToken(user);
        String rawRefreshToken = jwtUtil.generateRefreshToken(user);

        refreshTokenMapper.insert(RefreshToken.builder()
                .userId(user.getId())
                .token(rawRefreshToken)
                .expiresAt(OffsetDateTime.now().plusSeconds(jwtUtil.getRefreshExpirationMs() / 1000))
                .revoked(false)
                .build());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .user(LoginResponse.UserInfo.builder()
                        .id(user.getId().toString())
                        .email(user.getEmail())
                        .name(user.getFullName())
                        .fullName(user.getFullName())
                        .role(user.getRole())
                        .build())
                .build();
    }

    public TokenResponse refresh(RefreshTokenRequest request) {
        RefreshToken stored = refreshTokenMapper.findByToken(request.getRefreshToken());
        if (stored == null) {
            throw AppException.unauthorized("Refresh token không hợp lệ hoặc đã bị thu hồi");
        }
        if (stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            refreshTokenMapper.revoke(stored.getToken());
            throw AppException.unauthorized("Refresh token đã hết hạn");
        }

        Optional<User> optionalUser = userMapper.findById(stored.getUserId());
        if (optionalUser.isEmpty()) {
            throw AppException.unauthorized("Người dùng không tồn tại");
        }

        User user = optionalUser.get();

        refreshTokenMapper.revoke(stored.getToken());

        String newAccessToken = jwtUtil.generateAccessToken(user);
        String newRefreshToken = jwtUtil.generateRefreshToken(user);

        refreshTokenMapper.insert(RefreshToken.builder()
                .userId(user.getId())
                .token(newRefreshToken)
                .expiresAt(OffsetDateTime.now().plusSeconds(jwtUtil.getRefreshExpirationMs() / 1000))
                .revoked(false)
                .build());

        return TokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .expiresIn(jwtUtil.getRefreshExpirationMs() / 1000)
                .build();
    }

    public void logout(RefreshTokenRequest request) {
        refreshTokenMapper.revoke(request.getRefreshToken());
    }
}
