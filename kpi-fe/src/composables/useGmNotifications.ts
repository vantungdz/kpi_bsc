import { ref } from 'vue'

export type GmNotificationVariant = 'success' | 'error' | 'info'

export interface GmNotificationItem {
  id: string
  message: string
  variant: GmNotificationVariant
}

const items = ref<GmNotificationItem[]>([])
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Danh sách thông báo (mới nhất trên cùng). Dùng trong template layout GM. */
export function useGmNotificationItems() {
  return items
}

export function dismissGmNotification(id: string) {
  const t = timers.get(id)
  if (t != null) {
    clearTimeout(t)
    timers.delete(id)
  }
  items.value = items.value.filter((x) => x.id !== id)
}

/**
 * Thêm thông báo dạng card (chuẩn bị hiển thị góc phải layout GM).
 * @param durationMs — sau khoảng này tự đóng (mặc định theo variant).
 */
export function pushGmNotification(
  message: string,
  opts?: { variant?: GmNotificationVariant; durationMs?: number },
) {
  const trimmed = message.trim()
  if (!trimmed) return
  const variant = opts?.variant ?? 'success'
  const durationMs =
    opts?.durationMs ?? (variant === 'error' ? 8000 : variant === 'info' ? 5500 : 4500)
  const id = genId()
  items.value = [{ id, message: trimmed, variant }, ...items.value]
  const t = setTimeout(() => dismissGmNotification(id), durationMs)
  timers.set(id, t)
}

/** Gỡ toàn bộ thông báo (ví dụ khi unmount layout). */
export function clearAllGmNotifications() {
  for (const x of items.value) {
    const t = timers.get(x.id)
    if (t != null) clearTimeout(t)
    timers.delete(x.id)
  }
  items.value = []
}
