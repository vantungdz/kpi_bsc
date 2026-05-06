import axios from 'axios'

/**
 * Lấy chuỗi lỗi hiển thị cho user từ lỗi Axios / Error (đồng bộ với interceptor trong `api.ts`).
 */
export function getApiErrorMessage(error: unknown, fallback = 'Lỗi không xác định'): string {
  if (axios.isAxiosError(error)) {
    const raw = error.response?.data
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const m = (raw as { message?: unknown }).message
      if (typeof m === 'string' && m.trim()) return m.trim()
    }
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    const em = error.message?.trim() ?? ''
    if (em && !/^Request failed with status code \d+$/i.test(em)) return em
    const st = error.response?.status
    if (st != null) return `Lỗi máy chủ (HTTP ${st}).`
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return fallback
}
