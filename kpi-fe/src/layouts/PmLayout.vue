<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import PmAssignKpiDrawer from "@/components/pm/drawers/PmAssignKpiDrawer.vue";

const route = useRoute();
const { user, logout } = useAuth();

const navItems = [
  { name: "Dashboard", icon: "fas fa-chart-pie", to: "/pm/dashboard" },
];

const isActive = (path: string) => route.path.startsWith(path);

// State điều khiển Drawer tạo mới KPI
const showCreateDrawer = ref(false);

const handleKpiCreated = (payload: any) => {
  console.log("Đã tạo KPI mới:", payload);
  // Thực tế sẽ gọi API và Toast thông báo ở đây
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <aside
      class="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 shadow-sm"
    >
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <div
          class="bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-1.5 rounded-lg shadow-md mr-3"
        >
          <i class="fas fa-bullseye text-sm" />
        </div>
        <div>
          <span class="text-lg font-bold text-slate-900 tracking-tight"
            >KPI System</span
          >
          <p
            class="text-[10px] text-slate-400 font-medium uppercase tracking-wider"
          >
            PM Portal
          </p>
        </div>
      </div>

      <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p
          class="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3"
        >
          Navigation
        </p>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="
            isActive(item.to)
              ? 'bg-purple-50 text-purple-700 border-purple-100 shadow-sm'
              : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'
          "
        >
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="
              isActive(item.to)
                ? 'bg-purple-100 text-purple-600'
                : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
            "
          >
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span
            v-if="isActive(item.to)"
            class="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"
          />
        </RouterLink>
      </nav>

      <div class="p-4 border-t border-slate-200">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs font-medium"
          @click="logout"
        >
          <span
            class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"
          >
            <i class="fas fa-sign-out-alt text-xs" />
          </span>
          Đăng xuất
        </button>
      </div>
    </aside>

    <main class="flex-1 flex flex-col h-screen min-w-0">
      <header
        class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10"
      >
        <div>
          <p
            class="text-xs font-bold text-purple-600 uppercase tracking-widest"
          >
            PM Portal
          </p>
          <h2 class="text-xl font-bold text-slate-800">KPI Management</h2>
        </div>
        <div class="flex items-center gap-4">
          <button @click="showCreateDrawer = true" class="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-purple-700">
            <i class="fas fa-plus text-xs" /> Create KPI
          </button>

          <div class="text-right pl-4 border-l border-slate-200">
            <p class="text-sm font-bold text-slate-800">
              {{ user?.name ?? "–" }}
            </p>
            <p class="text-xs text-slate-500">{{ user?.rank ?? "PM" }}</p>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto bg-slate-50 relative">
        <RouterView />
      </div>

      <PmAssignKpiDrawer 
        :open="showCreateDrawer" 
        mode="create" 
        @close="showCreateDrawer = false" 
        @save="handleKpiCreated" 
      />
    </main>
  </div>
</template>