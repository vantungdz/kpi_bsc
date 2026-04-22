/**
 * mock-adapter.ts
 * Custom Axios adapter for KPI system — intercepts HTTP requests and serves
 * responses from src/mocks/ when VITE_USE_MOCK=true.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { LoginResponse, AuthTokens, ApiResponse } from '@/types/api'
import { mockResponse } from '@/utils/mock'
import { generateMockToken, generateMockRefreshToken } from '@/utils/mock'
import { MOCK_USERS_DB } from '@/mocks/auth.mock'
import { getMockGmKpiDashboard, getMockSectionMembers } from '@/mocks/gm-kpi.mock'
import { getMockMemberKpiDashboard } from '@/mocks/member-kpi.mock'
import { getMockLeaderKpiDashboard } from '@/mocks/leader-kpi.mock'
import { getMockPmKpiDashboard } from '@/mocks/pm-kpi.mock'

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function extractPath(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? ''
  const withoutHost = url.replace(/^https?:\/\/[^/]+/, '')
  const withoutApi = withoutHost.replace(/^\/api/, '')
  const withoutVersion = withoutApi.replace(/^\/v\d+/, '')
  return withoutVersion.split('?')[0] || '/'
}

function getQueryParams(config: InternalAxiosRequestConfig): Record<string, string> {
  const result: Record<string, string> = {}
  if (config.params) {
    for (const [k, v] of Object.entries(config.params)) result[k] = String(v)
  }
  try {
    const qIdx = (config.url ?? '').indexOf('?')
    if (qIdx >= 0) {
      new URLSearchParams((config.url ?? '').slice(qIdx + 1)).forEach((v, k) => { result[k] = v })
    }
  } catch { /* ignore */ }
  return result
}

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  if (!config.data) return {} as T
  if (typeof config.data === 'string') return JSON.parse(config.data) as T
  return config.data as T
}

function ok<T>(cfg: InternalAxiosRequestConfig, data: T): AxiosResponse<ApiResponse<T>> {
  return {
    data: mockResponse(data),
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config: cfg,
  }
}

function fail(cfg: InternalAxiosRequestConfig, status: number, message: string): never {
  const err = Object.assign(new Error(message), {
    isAxiosError: true,
    config: cfg,
    response: {
      data: mockResponse(null, message, status),
      status,
      statusText: String(status),
      headers: {},
      config: cfg,
    } as AxiosResponse,
  })
  throw err
}

type Handler = (cfg: InternalAxiosRequestConfig, path: string) => Promise<AxiosResponse>
interface Route { method: string; test: (path: string) => boolean; handler: Handler }

const routes: Route[] = [
  // ── POST /auth/login ──────────────────────────────────────────────────────
  {
    method: 'post',
    test: (p) => p === '/auth/login',
    handler: async (cfg) => {
      await sleep(500)
      const { email, password } = parseBody<{ email: string; password: string }>(cfg)
      const found = MOCK_USERS_DB.find(u => u.email === email && u.password === password)
      if (!found) fail(cfg, 401, 'Email hoặc mật khẩu không đúng.')
      const { password: _pw, ...userData } = found!
      return ok<LoginResponse>(cfg, {
        accessToken: generateMockToken(userData.id, userData.role),
        refreshToken: generateMockRefreshToken(userData.id),
        user: { ...userData, fullName: userData.name },
      })
    },
  },

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  {
    method: 'post',
    test: (p) => p === '/auth/refresh',
    handler: async (cfg) => {
      await sleep(300)
      const { refreshToken } = parseBody<{ refreshToken: string }>(cfg)
      if (!refreshToken?.startsWith('refresh.')) fail(cfg, 401, 'Refresh token không hợp lệ.')
      const userId = atob(refreshToken.replace('refresh.', '')).slice(0, 3)
      return ok<AuthTokens>(cfg, {
        accessToken: generateMockToken(userId, 'MEMBER'),
        refreshToken: generateMockRefreshToken(userId),
        expiresIn: 3600,
      })
    },
  },

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  {
    method: 'post',
    test: (p) => p === '/auth/logout',
    handler: async (cfg) => {
      await sleep(200)
      return ok(cfg, null)
    },
  },

  // ── GET /kpi/gm/dashboard?year=YYYY ──────────────────────────────────────
  {
    method: 'get',
    test: (p) => p === '/kpi/gm/dashboard',
    handler: async (cfg) => {
      await sleep(400)
      const { year } = getQueryParams(cfg)
      return ok(cfg, getMockGmKpiDashboard(year ? parseInt(year) : 2025))
    },
  },

  // ── GET /kpi/gm/sections/:id/members ─────────────────────────────────────
  {
    method: 'get',
    test: (p) => /^\/kpi\/gm\/sections\/[^/]+\/members$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300)
      const sectionId = path.split('/')[4]
      return ok(cfg, getMockSectionMembers(sectionId))
    },
  },

  // ── GET /kpi/member/dashboard?year=YYYY ──────────────────────────────────
  {
    method: 'get',
    test: (p) => p === '/kpi/member/dashboard',
    handler: async (cfg) => {
      await sleep(350)
      const { year } = getQueryParams(cfg)
      return ok(cfg, getMockMemberKpiDashboard(year ? parseInt(year) : 2025))
    },
  },

  // ── PUT /kpi/member/sheet/:itemId ─────────────────────────────────────────
  {
    method: 'put',
    test: (p) => /^\/kpi\/member\/sheet\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300)
      const itemId = path.split('/')[4]
      const { selfScore } = parseBody<{ selfScore: number }>(cfg)
      return ok(cfg, { id: itemId, selfScore })
    },
  },

  // ── POST /kpi/member/sheet/submit ─────────────────────────────────────────
  {
    method: 'post',
    test: (p) => p === '/kpi/member/sheet/submit',
    handler: async (cfg) => {
      await sleep(500)
      return ok(cfg, { status: 'submitted' })
    },
  },

  // ── POST /kpi/member/sheet/save-draft ─────────────────────────────────────
  {
    method: 'post',
    test: (p) => p === '/kpi/member/sheet/save-draft',
    handler: async (cfg) => {
      await sleep(300)
      return ok(cfg, { status: 'draft' })
    },
  },

  // ── GET /kpi/leader/dashboard?year=YYYY ──────────────────────────────────
  {
    method: 'get',
    test: (p) => p === '/kpi/leader/dashboard',
    handler: async (cfg) => {
      await sleep(350)
      const { year } = getQueryParams(cfg)
      return ok(cfg, getMockLeaderKpiDashboard(year ? parseInt(year) : 2025))
    },
  },

  // ── GET /kpi/pm/dashboard?year=YYYY ──────────────────────────────────────
  {
    method: 'get',
    test: (p) => p === '/kpi/pm/dashboard',
    handler: async (cfg) => {
      await sleep(350)
      const { year } = getQueryParams(cfg)
      return ok(cfg, getMockPmKpiDashboard(year ? parseInt(year, 10) : new Date().getFullYear()))
    },
  },

  // ── PUT /kpi/pm/sheet/:memberId/:itemId ───────────────────────────────────
  {
    method: 'put',
    test: (p) => /^\/kpi\/pm\/sheet\/[^/]+\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300)
      const parts = path.split('/')
      const itemId = parts[5]
      const { pmScore } = parseBody<{ pmScore: number }>(cfg)
      return ok(cfg, { id: itemId, pmScore })
    },
  },

  // ── POST /kpi/pm/sheet/:memberId/approve ──────────────────────────────────
  {
    method: 'post',
    test: (p) => /^\/kpi\/pm\/sheet\/[^/]+\/approve$/.test(p),
    handler: async (cfg) => {
      await sleep(400)
      return ok(cfg, null)
    },
  },

  // ── PUT /kpi/leader/sheet/:memberId/:itemId ───────────────────────────────
  {
    method: 'put',
    test: (p) => /^\/kpi\/leader\/sheet\/[^/]+\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300)
      const parts = path.split('/')
      const itemId = parts[5]
      const { leaderScore } = parseBody<{ leaderScore: number }>(cfg)
      return ok(cfg, { id: itemId, leaderScore })
    },
  },
]

export const mockAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  const path = extractPath(config)

  for (const route of routes) {
    if (route.method !== method) continue
    if (route.test(path)) return route.handler(config, path)
  }

  console.warn(`[MockAdapter] No handler for ${method.toUpperCase()} ${path}`)
  fail(config, 404, `[Mock] No handler for ${method.toUpperCase()} ${path}`)
}
