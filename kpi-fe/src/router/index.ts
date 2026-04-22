import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import AuthLayout from '@/layouts/AuthLayout.vue'
import GmLayout from '@/layouts/GmLayout.vue'
import MemberLayout from '@/layouts/MemberLayout.vue'
import LeaderLayout from '@/layouts/LeaderLayout.vue'
import PmLayout from '@/layouts/PmLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    // ─── Auth ────────────────────────────────────────────────────────────────
    {
      path: '/login',
      component: AuthLayout,
      meta: { requiresGuest: true },
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/pages/auth/LoginPage.vue'),
        },
      ],
    },

    // ─── GM area ─────────────────────────────────────────────────────────────
    {
      path: '/gm',
      component: GmLayout,
      meta: { requiresAuth: true, role: 'GM' },
      children: [
        {
          path: 'dashboard',
          name: 'gm-dashboard',
          component: () => import('@/pages/gm/GmRouterStub.vue'),
        },
        {
          path: 'employee-evaluation',
          name: 'gm-employee-evaluation',
          component: () => import('@/pages/gm/GmEmployeeEvaluationHub.vue'),
        },
        {
          path: 'settings/create-section',
          name: 'gm-create-section',
          component: () => import('@/pages/gm/GmCreateSectionPage.vue'),
        },
        {
          path: 'settings/kpi-template',
          name: 'gm-kpi-template',
          component: () => import('@/pages/gm/GmKpiTemplateLibraryPage.vue'),
        },
      ],
    },

    // ─── Member area ──────────────────────────────────────────────────────────
    {
      path: '/member',
      component: MemberLayout,
      meta: { requiresAuth: true, role: 'MEMBER' },
      children: [
        {
          path: 'dashboard',
          name: 'member-dashboard',
          component: () => import('@/pages/member/MemberDashboard.vue'),
        },
        {
          path: 'kpi-sheet',
          name: 'member-kpi-sheet',
          component: () => import('@/pages/member/MemberDashboard.vue'), // same page full sheet
        },
        {
          path: 'evidence',
          redirect: { name: 'member-dashboard' },
        },
        {
          path: 'history',
          name: 'member-history',
          component: () => import('@/pages/member/MemberDashboard.vue'),
        },
        {
          path: 'guidelines',
          name: 'member-guidelines',
          component: () => import('@/pages/member/GuidelinesPage.vue'),
        },
      ],
    },

    // ─── Leader area ──────────────────────────────────────────────────────────
    {
      path: '/leader',
      component: LeaderLayout,
      meta: { requiresAuth: true, role: 'LEADER' },
      children: [
        {
          path: 'dashboard',
          name: 'leader-dashboard',
          component: () => import('@/pages/leader/LeaderDashboard.vue'),
        },
        {
          path: 'team',
          name: 'leader-team',
          component: () => import('@/pages/leader/LeaderManager.vue'),
        },
      ],
    },

    // ─── PM area ──────────────────────────────────────────────────────────────
    {
      path: '/pm',
      component: PmLayout,
      meta: { requiresAuth: true, role: 'PM' },
      children: [
        {
          path: 'dashboard',
          name: 'pm-dashboard',
          component: () => import('@/pages/pm/PmDashboard.vue'),
        },
        {
          path: 'team',
          name: 'pm-team',
          component: () => import('@/pages/pm/PmManager.vue'),
        },
      ],
    },

    // ─── Fallback ─────────────────────────────────────────────────────────────
    {
      path: '/',
      redirect: () => {
        const auth = useAuthStore()
        if (!auth.isAuthenticated) return '/login'
        return auth.homeRoute
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/',
    },
  ],
})

// ─── Navigation guard ─────────────────────────────────────────────────────────
router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.requiresGuest && auth.isAuthenticated) {
    next(auth.homeRoute)
    return
  }

  if (to.meta.role === 'GM' && auth.user?.role !== 'GM') {
    next(auth.homeRoute)
    return
  }

  if (to.meta.role === 'PM' && auth.user?.role !== 'PM') {
    next(auth.homeRoute)
    return
  }

  if (to.meta.role === 'LEADER' && auth.user?.role !== 'LEADER') {
    next(auth.homeRoute)
    return
  }

  if (to.meta.role === 'MEMBER' && auth.user?.role !== 'MEMBER') {
    next(auth.homeRoute)
    return
  }

  next()
})

export default router
