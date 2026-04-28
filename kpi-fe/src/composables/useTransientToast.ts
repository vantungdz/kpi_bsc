import { ref, type Ref } from 'vue'

export type TransientToastVariant = 'success' | 'error'

export type UseTransientToastReturn = {
  visible: Ref<boolean>
  message: Ref<string>
  variant: Ref<TransientToastVariant>
  show: (msg: string, v?: TransientToastVariant) => void
  hide: () => void
}

/**
 * Toast/snackbar đơn giản — tự ẩn sau `dismissMs`.
 * Dùng cho trang không có store thông báo toàn cục.
 */
export function useTransientToast(dismissMs = 4000): UseTransientToastReturn {
  const visible = ref(false)
  const message = ref('')
  const variant = ref<TransientToastVariant>('success')
  let timer: ReturnType<typeof setTimeout> | null = null

  function hide() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    visible.value = false
  }

  function show(msg: string, v: TransientToastVariant = 'success') {
    message.value = msg
    variant.value = v
    visible.value = true
    if (timer != null) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
      timer = null
    }, dismissMs)
  }

  return { visible, message, variant, show, hide }
}
