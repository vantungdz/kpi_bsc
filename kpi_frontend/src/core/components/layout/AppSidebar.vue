<template>
  <a-layout-sider collapsible theme="light" class="app-sidebar-component">
    <div class="logo-area">
      <img src="../../assets/logo.png" alt="Logo" class="sidebar-logo" />
    </div>

    <a-menu theme="light" mode="inline" class="menu-list">
      <a-menu-item key="dashboard" v-if="canViewDashboard">
        <router-link to="/dashboard">
          <dashboard-outlined />
          <span>Dashboard</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="performance" v-if="effectiveRole">
        <router-link to="/performance">
          <bar-chart-outlined />
          <span>Performance Objectives</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="employees" v-if="canViewDashboard">
        <router-link to="/employees">
          <team-outlined />
          <span>Employee List</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="evaluation" v-if="effectiveRole">
        <router-link to="/kpi/review">
          <solution-outlined />
          <span>Evaluation</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="kpis-company" v-if="canViewCompanyLevel">
        <router-link to="/kpis/company">
          <global-outlined />
          <span>Company KPI List</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="kpis-department" v-if="canViewDepartmentLevel">
        <router-link to="/kpis/department">
          <apartment-outlined />
          <span>Department KPI List</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="kpis-section" v-if="canViewSectionLevel">
        <router-link to="/kpis/section">
          <cluster-outlined />
          <span>Section KPI List</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="approvals" v-if="canViewApprovals">
        <router-link to="/approvals">
          <check-square-outlined />
          <span>Duyệt Kết quả KPI</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="personal-kpis" v-if="effectiveRole">
        <router-link to="/personal">
          <user-outlined />
          <span>My Personal KPIs</span>
        </router-link>
      </a-menu-item>

      <a-menu-item key="my-review" v-if="effectiveRole">
        <router-link to="/my-kpi-review">
          <audit-outlined />
          <span>My KPI Review</span>
        </router-link>
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
// Vue core imports
import { computed } from "vue";
// Vuex store
import { useStore } from "vuex";
// Ant Design Vue components and icons
import {
  LayoutSider as ALayoutSider,
  Menu as AMenu,
  MenuItem as AMenuItem,
  SubMenu as ASubMenu,
} from "ant-design-vue";
import {
  SettingOutlined,
  DashboardOutlined,
  BarChartOutlined,
  TeamOutlined,
  SolutionOutlined,
  GlobalOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  CheckSquareOutlined,
  UserOutlined,
  AuditOutlined,
} from "@ant-design/icons-vue";

// Store instance
const store = useStore();

// Computed property for user role
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);

// Permission for viewing Dashboard (example: admin and manager)
const canViewDashboard = computed(() =>
  ["admin", "manager"].includes(effectiveRole.value)
);

// Permissions for viewing different KPI levels
const canViewCompanyLevel = computed(() =>
  ["admin", "manager"].includes(effectiveRole.value)
);
const canViewDepartmentLevel = computed(() =>
  ["admin", "manager", "department"].includes(effectiveRole.value)
);
const canViewSectionLevel = computed(() =>
  ["admin", "manager", "department", "section"].includes(effectiveRole.value)
);

// Permission for viewing approvals
const canViewApprovals = computed(() => {
  if (!effectiveRole.value) return false;
  return ["manager", "admin", "department", "section", "employee"].includes(
    effectiveRole.value
  );
});

// // Example computed for other conditional links
// const isManagerOrAdmin = computed(() => {
//    if (!userRole.value) return false;
//    return ['manager', 'admin'].includes(userRole.value);
// });
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
