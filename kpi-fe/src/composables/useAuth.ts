/**
 * useAuth.ts
 * Authentication composable wrapping the Pinia auth store + auth API calls.
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { apiLogin, apiLogout } from '@/services/modules/auth.api'
import type { LoginRequest } from '@/types/api'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  const isLoading = ref(false)
  const loginError = ref<string | null>(null)

  const user = computed(() => store.user)
  const isAuthenticated = computed(() => store.isAuthenticated)
  const isGm = computed(() => store.isGm)
  const isPm = computed(() => store.isPm)
  const isLeader = computed(() => store.isLeader)
  const isMember = computed(() => store.isMember)

  async function login(payload: LoginRequest): Promise<boolean> {
    isLoading.value = true
    loginError.value = null

    try {
      const response = await apiLogin(payload)
      const { accessToken, refreshToken, user: userData } = response.data

      store.setAuth({ accessToken, refreshToken }, {
        ...userData,
        name: userData.name ?? userData.fullName ?? '',
      })

      await router.push(store.homeRoute)
      return true
    } catch (e) {
      loginError.value = e instanceof Error ? e.message : 'Đăng nhập thất bại.'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    try {
      await apiLogout({ refreshToken: store.refreshToken ?? '' })
    } catch {
      // proceed even if API fails
    } finally {
      store.clearAuth()
      isLoading.value = false
      await router.push({ name: 'login' })
    }
  }

  return {
    user,
    isAuthenticated,
    isGm,
    isPm,
    isLeader,
    isMember,
    isLoading,
    loginError,
    login,
    logout,
  }
}
