import type { ApiResponse, PageData } from '@/types/api'

export function mockResponse<T>(data: T, message: string | null = null, status = 200): ApiResponse<T> {
  return {
    success: status >= 200 && status < 300,
    message,
    timestamp: new Date().toISOString(),
    status,
    data,
  }
}

export function mockPageResponse<T>(items: T[], page = 0, size = 20): ApiResponse<PageData<T>> {
  const start = page * size
  const content = items.slice(start, start + size)
  return mockResponse<PageData<T>>({
    content,
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
    first: page === 0,
    last: start + size >= items.length,
  })
}

export function generateMockToken(userId: string, role: string): string {
  return `mock.${btoa(`${userId}:${role}:${Date.now()}`)}`
}

export function generateMockRefreshToken(userId: string): string {
  return `refresh.${btoa(userId + Date.now())}`
}
