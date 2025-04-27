<template>
  <a-layout-sider collapsible theme="light" class="app-sidebar-component">
    <div class="logo-area">
      <img src="../assets/logo.png" alt="Logo" class="sidebar-logo" />
    </div>

    <a-menu theme="light" mode="inline" class="menu-list">
      <a-menu-item key="1" v-if="effectiveRole">
        <router-link to="/performance">Performance Objectives</router-link>
      </a-menu-item>

      <a-menu-item key="2" v-if="canViewCompanyLevel">
        <router-link to="/kpis/company">Company KPI List</router-link>
      </a-menu-item>

      <a-menu-item key="3" v-if="canViewDepartmentLevel">
        <router-link to="/kpis/department">Department KPI List</router-link>
      </a-menu-item>

      <a-menu-item key="4" v-if="canViewSectionLevel">
        <router-link to="/kpis/section">Section KPI List</router-link>
      </a-menu-item>

      <!-- <a-menu-item key="5" v-if="canViewIndividualList">
        <router-link to="/kpis/individual">Individual KPI List</router-link>
      </a-menu-item> -->

      <a-menu-item key="6" v-if="effectiveRole">
        <router-link to="/personal">My Personal KPIs</router-link>
      </a-menu-item>

      <a-sub-menu key="admin" v-if="isAdmin">
        <template #title>
          <span><setting-outlined /><span>Administration</span></span>
        </template>
        <a-menu-item key="admin-users">
          <router-link to="/admin/users">User Management</router-link>
        </a-menu-item>
        <a-menu-item key="admin-roles">
          <router-link to="/admin/roles">Role Management</router-link>
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
  </a-layout-sider>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
// Import Ant Design components và icons
import {
  LayoutSider as ALayoutSider,
  Menu as AMenu,
  MenuItem as AMenuItem,
  SubMenu as ASubMenu,
} from "ant-design-vue";
import { SettingOutlined } from "@ant-design/icons-vue";

const store = useStore();

// Chỉ cần lấy effectiveRole từ store
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
// const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']); // <<< Bỏ qua getter này

// === Computed Properties để kiểm tra quyền (Vẫn dựa trên effectiveRole) ===
const isAdmin = computed(() => effectiveRole.value === "admin");
// const isCompany = computed(() => effectiveRole.value === 'company');
// const isDepartment = computed(() => effectiveRole.value === 'department');
// const isSection = computed(() => effectiveRole.value === 'section');
// const isEmployee = computed(() => effectiveRole.value === 'employee');

// Quyền xem các mục menu (Chỉ dựa vào effectiveRole)
const canViewCompanyLevel = computed(() =>
  ["admin", "manager", "department", "section"].includes(effectiveRole.value)
);
const canViewDepartmentLevel = computed(() =>
  ["admin", "manager", "department", "section"].includes(effectiveRole.value)
);
const canViewSectionLevel = computed(() =>
  ["admin", "manager", "department", "section"].includes(effectiveRole.value)
);
</script>

<style scoped>
.app-sidebar-component {
  background: linear-gradient(to bottom right, #e0f7fa, #f8f9fa);
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f0f0f0;
}

.logo-area {
  height: 61px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  flex-shrink: 0;
  border-bottom: 1px solid #f0f0f0;
}

.sidebar-logo {
  height: 50px;
  max-width: 100%;
}

.menu-list {
  background: transparent;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important;
}

:deep(.ant-menu-light .ant-menu-item a) {
  color: rgba(0, 0, 0, 0.85);
}
:deep(.ant-menu-light .ant-menu-item-selected a),
:deep(.ant-menu-light .ant-menu-item a:hover) {
  color: var(--brand-primary);
}
:deep(.ant-menu-light .ant-menu-item-selected) {
  background-color: color-mix(
    in srgb,
    var(--brand-primary) 10%,
    transparent
  ) !important;
}
:deep(.ant-menu-light .ant-menu-submenu-title:hover) {
  color: var(--brand-primary);
}

/* .logged-out-message {
    padding: 20px;
    text-align: center;
    color: #888;
} */
</style>
