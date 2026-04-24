<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { user, logout } = useAuth()

const navItems = [
  { name: 'Chiến dịch Đánh giá', icon: 'fas fa-bullhorn',  to: '/admin/campaigns'       },
  { name: 'Danh sách Nhân sự',   icon: 'fas fa-users',     to: '/admin/employees'       },
  { name: 'Mẫu Email',           icon: 'fas fa-envelope',  to: '/admin/email-templates' },
]

const isActive = (path: string) => route.path.startsWith(path)

const userInitials = computed(() => {
  const name = user.value?.fullName || user.value?.name || 'AD'
  return name.split(' ').map((w: string) => w[0]).slice(-2).join('').toUpperCase()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── SIDEBAR ──────────────────────────────────────────────────────────── -->
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 shadow-sm">

      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <div class="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-1.5 rounded-lg shadow-md mr-3">
          <i class="fas fa-cog text-sm" />
        </div>
        <div>
          <span class="text-lg font-bold text-slate-900 tracking-tight">KPI System</span>
          <p class="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Admin Workspace</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p class="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Quản trị Hệ thống
        </p>

        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="isActive(item.to)
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'"
        >
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="isActive(item.to)
              ? 'bg-indigo-100 text-indigo-600'
              : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'"
          >
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span
            v-if="isActive(item.to)"
            class="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"
          />
        </RouterLink>
      </nav>

      <!-- Logout -->
      <div class="p-4 border-t border-slate-200">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs font-medium"
          @click="logout"
        >
          <span class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <i class="fas fa-sign-out-alt text-xs" />
          </span>
          Đăng xuất
        </button>
      </div>
    </aside>

    <!-- ── MAIN ──────────────────────────────────────────────────────────────── -->
    <main class="flex-1 flex flex-col h-screen min-w-0">

      <!-- Header -->
      <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
        <div>
          <p class="text-xs font-bold text-indigo-600 uppercase tracking-widest">Admin Workspace</p>
          <h2 class="text-xl font-bold text-slate-800">Quản trị Hệ thống</h2>
        </div>

        <!-- User info -->
        <div class="flex items-center gap-4">
          <div class="text-right pl-4 border-l border-slate-200">
            <p class="text-sm font-bold text-slate-800">{{ user?.fullName ?? user?.name ?? 'System Admin' }}</p>
            <p class="text-xs text-slate-500">{{ user?.position ?? 'HR Department' }}</p>
          </div>
          <div class="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {{ userInitials }}
          </div>
        </div>
      </header>

      <!-- Page content -->
      <div class="flex-1 overflow-y-auto bg-slate-50 relative">
        <RouterView />
      </div>
    </main>

  </div>
</template>
