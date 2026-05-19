<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { user, logout } = useAuth()

const navItems = [
  { name: 'Dashboard', icon: 'fas fa-home', to: '/member/dashboard' },
]

const isActive = (path: string) => route.path.startsWith(path)
</script>

<template>
  <div class="flex h-screen bg-slate-50 overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col z-20 shadow-sm shrink-0">
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <div class="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-1.5 rounded-lg shadow-md mr-3">
          <i class="fas fa-bullseye text-xl mx-auto" />
        </div>
        <span class="text-lg font-bold text-slate-900 tracking-tight">KPI System</span>
      </div>

      <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <p class="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Navigation</p>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="isActive(item.to)
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'"
        >
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="isActive(item.to) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'"
          >
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span v-if="isActive(item.to)" class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        </RouterLink>

        <!-- <p class="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-6 mb-3">Hỗ Trợ</p>
        <RouterLink
          to="/member/guidelines"
          class="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg font-medium transition-colors"
          :class="isActive('/member/guidelines') ? 'bg-blue-50 text-blue-700' : ''"
        >
          <i class="fas fa-book-open w-5 text-center" />
          Guideline & Quy Định
        </RouterLink> -->
      </nav>

      <div class="p-4 border-t border-slate-200">
        <button
          class="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-rose-600 transition-colors text-sm font-medium mt-1 w-full cursor-pointer"
          @click="logout"
        >
          <i class="fas fa-sign-out-alt w-4 text-center cursor-pointer" /> Sign out
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex-1 flex flex-col h-screen overflow-hidden">
      <header class="h-16 bg-white border-b border-slate-200 px-6 flex justify-between items-center sticky top-0 z-10 shrink-0">
        <div class="flex items-center gap-3">
          <button class="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
            <i class="fas fa-bars" />
          </button>
          <div>
          <p
            class="text-xs font-bold text-blue-600 uppercase tracking-widest"
          >
            Member Portal
          </p>
          <h2 class="text-xl font-bold text-slate-800">KPI Management</h2>
        </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer">
            <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200 text-xs">
              {{ (user?.name ?? '?').charAt(0).toUpperCase() }}
            </div>
            <div class="hidden md:block">
              <p class="text-sm font-bold text-slate-700 leading-tight">{{ user?.name ?? '–' }}</p>
              <p class="text-xs text-slate-400 font-medium">Rank: {{ user?.rank ?? user?.role }}</p>
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
