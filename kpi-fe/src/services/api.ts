/**
 * api.ts — Axios instance for KPI system with:
 *   - Mock adapter when VITE_USE_MOCK=true (reads from src/mocks/)
 *   - Real HTTP calls when VITE_USE_MOCK=false (hits Java backend)
 *   - JWT Authorization header
 *   - Automatic token refresh on 401
 *   - Redirect to /login if refresh fails
 */
import axios, { type AxiosRequestConfig } from 'axios'
import { mockAdapter } from './mock-adapter'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  adapter: USE_MOCK ? mockAdapter : undefined,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('kpi_accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

function enqueueRefresh(cb: (token: string) => void) { refreshQueue.push(cb) }
function drainRefreshQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token))
  refreshQueue = []
}

const httpRefresh = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  adapter: USE_MOCK ? mockAdapter : undefined,
})

type RetryConfig = AxiosRequestConfig & { _retry?: boolean }

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original: RetryConfig = error.config

    const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      const storedRefresh = localStorage.getItem('kpi_refreshToken')

      if (!storedRefresh) {
        redirectToLogin()
        return Promise.reject(new Error('Session expired. Please log in again.'))
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          enqueueRefresh((newToken) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
            resolve(http(original))
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await httpRefresh.post('/auth/refresh', { refreshToken: storedRefresh })
        const newAccessToken: string = data.data.accessToken

        localStorage.setItem('kpi_accessToken', newAccessToken)
        http.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`
        drainRefreshQueue(newAccessToken)

        original.headers = { ...original.headers, Authorization: `Bearer ${newAccessToken}` }
        return http(original)
      } catch {
        redirectToLogin()
        return Promise.reject(new Error('Session expired. Please log in again.'))
      } finally {
        isRefreshing = false
      }
    }

    const message =
      error?.response?.data?.message ??
      error?.message ??
      'Unexpected server error'

    return Promise.reject(new Error(message))
  },
)

function redirectToLogin() {
  localStorage.removeItem('kpi_accessToken')
  localStorage.removeItem('kpi_refreshToken')
  localStorage.removeItem('kpi_user')
  window.dispatchEvent(new CustomEvent('app:session-expired'))
}

export default http
