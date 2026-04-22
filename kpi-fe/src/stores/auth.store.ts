import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('kpi_accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('kpi_refreshToken'))
  const user = ref<AuthUser | null>(
    (() => {
      try {
        const raw = localStorage.getItem('kpi_user')
        return raw ? (JSON.parse(raw) as AuthUser) : null
      } catch {
        return null
      }
    })(),
  )

  const isAuthenticated = computed(() => !!accessToken.value)
  const isGm = computed(() => user.value?.role === 'GM')
  const isPm = computed(() => user.value?.role === 'PM')
  const isLeader = computed(() => user.value?.role === 'LEADER')
  const isMember = computed(() => user.value?.role === 'MEMBER')

  const homeRoute = computed(() => {
    if (user.value?.role === 'GM') return '/gm/dashboard'
    if (user.value?.role === 'PM') return '/pm/dashboard'
    if (user.value?.role === 'LEADER') return '/leader/dashboard'
    return '/member/dashboard'
  })

  function setAuth(tokens: { accessToken: string; refreshToken: string }, userData: AuthUser) {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    user.value = userData

    localStorage.setItem('kpi_accessToken', tokens.accessToken)
    localStorage.setItem('kpi_refreshToken', tokens.refreshToken)
    localStorage.setItem('kpi_user', JSON.stringify(userData))
  }

  function setAccessToken(token: string) {
    accessToken.value = token
    localStorage.setItem('kpi_accessToken', token)
  }

  function clearAuth() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null

    localStorage.removeItem('kpi_accessToken')
    localStorage.removeItem('kpi_refreshToken')
    localStorage.removeItem('kpi_user')
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    isGm,
    isPm,
    isLeader,
    isMember,
    homeRoute,
    setAuth,
    setAccessToken,
    clearAuth,
  }
})
