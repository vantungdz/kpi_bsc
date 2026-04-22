import http from '@/services/api'
import type { ApiResponse, LoginRequest, LoginResponse, AuthTokens } from '@/types/api'

export async function apiLogin(payload: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  return http.post('/auth/login', payload).then(r => r.data)
}

export async function apiLogout(payload: { refreshToken: string }): Promise<ApiResponse<null>> {
  return http.post('/auth/logout', payload).then(r => r.data)
}

export async function apiRefreshToken(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
  return http.post('/auth/refresh', { refreshToken }).then(r => r.data)
}
