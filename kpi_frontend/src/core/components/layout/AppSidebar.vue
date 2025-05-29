<template>
  <a-layout-sider collapsible v-model:collapsed="collapsed" :trigger="null" theme="dark"
    class="app-sidebar-component dark-sidebar" :width="220" :collapsedWidth="64">
    <div class="sidebar-inner">
      <div class="logo-area" :class="{ 'collapsed': collapsed }">
        <img src="../../assets/logo.png" alt="Company Logo" class="sidebar-logo" />
      </div>
      <a-menu :theme="'light'" mode="inline" class="menu-list" :inline-collapsed="collapsed">
        <div class="menu-group-title" v-if="!collapsed || canViewDashboard">{{ $t('sidebarGroup.dashboard') }}</div>
        <a-menu-item key="dashboard" v-if="canViewDashboard" :title="$t('dashboard')">
          <router-link to="/dashboard">
            <dashboard-outlined />
            <span>{{ $t('dashboard') }}</span>
          </router-link>
        </a-menu-item>

        <!-- 2. My Area (Sub-menu) -->
        <div class="menu-group-title" v-if="!collapsed ">{{ $t('sidebarGroup.myArea') }}</div>
        <a-sub-menu key="my-area" :title="$t('myArea')">
          <template #title>
            <span>
              <user-outlined />
              <span>{{ $t("myArea") }}</span>
            </span>
          </template>
          <a-menu-item key="personal-kpis" :title="$t('myPersonalKpis')">
            <router-link to="/personal">
              <profile-outlined />
              <span>{{ $t("myPersonalKpis") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="my-kpi-self-review" :title="$t('myKpiSelfReview')">
            <router-link to="/my-kpi-self-review">
              <form-outlined />
              <span>{{ $t("myKpiReview") }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>

        <div class="menu-group-title" v-if="!collapsed || canViewKpiManagementSubMenu">{{ $t('sidebarGroup.kpi') }}
        </div>
        <a-sub-menu key="kpi-management" v-if="canViewKpiManagementSubMenu" :title="$t('kpiManagement')">
          <template #title>
            <appstore-outlined />
            <span>{{ $t('kpiManagement') }}</span>
          </template>
          <a-menu-item key="kpis-company" v-if="canViewCompanyLevel" :title="$t('companyKpiList')">
            <router-link to="/kpis/company">
              <global-outlined />
              <span>{{ $t('companyKpiList') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="kpis-department" v-if="canViewDepartmentLevel" :title="$t('departmentKpiList')">
            <router-link to="/kpis/department">
              <apartment-outlined />
              <span>{{ $t('departmentKpiList') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="kpis-section" v-if="canViewSectionLevel" :title="$t('sectionKpiList')">
            <router-link to="/kpis/section">
              <cluster-outlined />
              <span>{{ $t('sectionKpiList') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="kpis-inactive" v-if="canViewInactiveKpiList" :title="$t('inactiveKpiList')">
            <router-link to="/kpis/inactive">
              <appstore-outlined />
              <span>{{ $t('inactiveKpiList') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="kpis-employee-management" v-if="canViewKpiEmployeeLevel"
            :title="$t('employeeKpiManagement')">
            <router-link to="/kpis/employee-management">
              <team-outlined />
              <span>{{ $t('employeeKpiManagement') }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>
        <div class="menu-group-title" v-if="!collapsed || canViewApprovalsReviewSubMenu">{{ $t('sidebarGroup.approval')
          }}</div>
        <a-sub-menu key="approvals-reviews" v-if="canViewApprovalsReviewSubMenu" :title="$t('approvalsAndReviews')">
          <template #title>
            <audit-outlined />
            <span>{{ $t('approvalsAndReviews') }}</span>
          </template>
          <a-menu-item key="approvals" v-if="canViewApprovals" :title="$t('kpiApproval')">
            <router-link to="/approvals">
              <check-square-outlined />
              <span>{{ $t('kpiApproval') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="performance-objective-approvals" v-if="canViewPerformanceObjectiveApprovals"
            :title="$t('performanceObjectiveApprovalMenu')">
            <router-link to="/performance-objective-approvals">
              <file-protect-outlined />
              <span>{{ $t('performanceObjectiveApprovalMenu') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="employee-kpi-score-list" v-if="canViewEmployeeKpiScores"
            :title="$t('employeeKpiScoreList')">
            <router-link to="/employee-kpi-scores">
              <bar-chart-outlined />
              <span>{{ $t('employeeKpiScoreList') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="kpi-review-list" v-if="canViewKpiReview" :title="$t('kpiReviewTitle')">
            <router-link to="/kpi-review">
              <solution-outlined />
              <span>{{ $t('kpiReviewTitle') }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>
        <div class="menu-group-title" v-if="!collapsed || canViewEmployeeList">{{ $t('sidebarGroup.employee') }}</div>
        <a-menu-item key="employees" v-if="canViewEmployeeList" :title="$t('employeeList')">
          <router-link to="/employees">
            <team-outlined />
            <span>{{ $t('employeeList') }}</span>
          </router-link>
        </a-menu-item>
        <div class="menu-group-title" v-if="!collapsed || canViewReport">{{ $t('sidebarGroup.report') }}</div>
        <a-menu-item key="report-generator" v-if="canViewReport" :title="$t('reportGenerator')">
          <router-link to="/report-generator">
            <bar-chart-outlined />
            <span>{{ $t('reportGenerator') }}</span>
          </router-link>
        </a-menu-item>
        <div class="menu-group-title" v-if="!collapsed || canViewAdminMenu">{{ $t('sidebarGroup.admin') }}</div>
        <a-sub-menu key="admin" v-if="canViewAdminMenu" :title="$t('administration')">
          <template #title>
            <setting-outlined />
            <span>{{ $t('administration') }}</span>
          </template>
          <a-menu-item key="admin-users" :title="$t('addRole')">
            <router-link to="/admin/create-role">
              <usergroup-add-outlined />
              <span>{{ $t('addRole') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-roles" :title="$t('roleManagement')">
            <router-link to="/user-role-manager">
              <key-outlined />
              <span>{{ $t('roleManagement') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-review-cycles" :title="$t('reviewCycleManagement')">
            <router-link to="/review-cycle/create">
              <form-outlined />
              <span>{{ $t('reviewCycleManagement') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-create-department" :title="$t('createDepartment')">
            <router-link to="/admin/create-department">
              <apartment-outlined />
              <span>{{ $t('createDepartment') }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-create-section" :title="$t('createSection')">
            <router-link to="/admin/create-section">
              <cluster-outlined />
              <span>{{ $t('createSection') }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>
      </a-menu>
      <div class="sidebar-toggle-area">
        <a-button class="sidebar-toggle" type="text" @click="toggleSidebar">
          <template #icon>
            <menu-unfold-outlined v-if="collapsed" />
            <menu-fold-outlined v-else />
          </template>
        </a-button>
      </div>
    </div>
  </a-layout-sider>
</template>

<script setup>
import { ref, computed } from "vue";
import { useStore } from "vuex";
import {
  LayoutSider as ALayoutSider,
  Menu as AMenu,
  MenuItem as AMenuItem,
  SubMenu as ASubMenu,
  Button as AButton,
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
  AuditOutlined,
  FileProtectOutlined,
  AppstoreOutlined,
  FormOutlined,
  UsergroupAddOutlined,
  KeyOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  ProfileOutlined
} from "@ant-design/icons-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const store = useStore();
const collapsed = ref(false);
function toggleSidebar() {
  collapsed.value = !collapsed.value;
}

// Lấy thông tin người dùng từ Vuex store
const user = computed(() => store.getters["auth/user"]);

// Lấy permissions đã tổng hợp từ backend (ưu tiên từ user.roles nếu có)
const userPermissions = computed(() => user.value?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action?.trim() === action && p.resource?.trim() === resource
  );
}

// Sử dụng resource hợp lệ từ RBAC_RESOURCES
const canViewDashboard = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD)
);
const canViewCompanyLevel = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_COMPANY)
);
const canViewDepartmentLevel = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_DEPARTMENT)
);
const canViewSectionLevel = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_SECTION)
);

const canViewInactiveKpiList = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE_COMPANY)
);

const canViewEmployeeList = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE_COMPANY)
);

const canViewApprovals = computed(
  () =>
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE)
);
const canViewReport = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.REPORT) 
);
const canViewKpiReview = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE)
);
const canViewEmployeeKpiScores = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE)
);

const canViewKpiEmployeeLevel = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_EMPLOYEE)
);

const canViewAdminMenu = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN)
);

const canViewKpiManagementSubMenu = computed(
  () =>
    canViewCompanyLevel.value ||
    canViewDepartmentLevel.value ||
    canViewSectionLevel.value
);

const canViewApprovalsReviewSubMenu = computed(() => canViewApprovals.value);
</script>

<style scoped>
.app-sidebar-component.dark-sidebar {
  background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%);
  color: #222;
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e0e6f6;
  position: relative;
  overflow: hidden;
}
.logo-area {
  height: 61px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-bottom: 1px solid #e0e6f6;
  position: relative;
  background: #e3f2fd;
  transition: all 0.2s;
}
.logo-area.collapsed {
  justify-content: center;
}
.sidebar-logo {
  height: 38px;
  max-width: 90%;
  margin: 0 auto;
  display: block;
  object-fit: contain;
  transition: height 0.2s, margin 0.2s;
}
:deep(.ant-layout-sider-collapsed) .sidebar-logo {
  height: 32px;
  max-width: 40px;
  margin: 0 auto;
}
.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}
.menu-list {
  background: transparent;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important;
  padding-top: 8px;
}
.sidebar-toggle-area {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0 18px 0;
  background: transparent;
  position: absolute;
  left: 0;
  bottom: 0;
  z-index: 10;
}
.sidebar-toggle {
  color: #1976d2;
  font-size: 1.4em;
  background: none;
  border: none;
  box-shadow: none;
  z-index: 2;
  transition: color 0.2s;
}
.sidebar-toggle:hover {
  color: #1565c0;
}
.menu-list {
  background: transparent;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important;
  padding-top: 8px;
}
.menu-group-title {
  color: #90caf9;
  font-size: 0.78em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 18px 0 6px 18px;
  opacity: 0.85;
}
:deep(.ant-menu-dark .ant-menu-item),
:deep(.ant-menu-dark .ant-menu-submenu-title) {
  border-radius: 6px;
  margin: 0 10px 2px 10px;
  padding: 0 12px !important;
  height: 40px;
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 500;
  transition: background 0.2s, color 0.2s;
  position: relative;
  color: #1976d2;
  background: transparent;
}
:deep(.ant-menu-dark .ant-menu-item a),
:deep(.ant-menu-dark .ant-menu-submenu-title) {
  color: #1976d2;
}
:deep(.ant-menu-dark .ant-menu-item-selected),
:deep(.ant-menu-dark .ant-menu-item-active),
:deep(.ant-menu-dark .ant-menu-submenu-title-active) {
  background: #e3f2fd !important;
  color: #1565c0 !important;
}
:deep(.ant-menu-dark .ant-menu-item-selected a),
:deep(.ant-menu-dark .ant-menu-item a:hover),
:deep(.ant-menu-dark .ant-menu-submenu-title:hover) {
  color: #1565c0 !important;
}
:deep(.ant-menu-dark .ant-menu-item .anticon),
:deep(.ant-menu-dark .ant-menu-submenu-title .anticon) {
  font-size: 18px;
  margin-right: 10px;
  vertical-align: middle;
  color: #1976d2;
  transition: color 0.2s;
}
:deep(.ant-menu-dark .ant-menu-item-selected .anticon),
:deep(.ant-menu-dark .ant-menu-item-active .ant-icon),
:deep(.ant-menu-dark .ant-menu-submenu-title-active .anticon) {
  color: #1565c0;
}
:deep(.ant-menu-dark .ant-menu-item .anticon),
:deep(.ant-menu-dark .ant-menu-submenu-title .anticon) {
  min-width: 18px;
  text-align: center;
}
:deep(.ant-menu-dark .ant-menu-item .anticon + span),
:deep(.ant-menu-dark .ant-menu-submenu-title .anticon + span) {
  margin-left: 2px;
}
:deep(.ant-menu-dark .ant-menu-item) {
  margin-bottom: 0;
}
:deep(.ant-menu-dark .ant-menu-submenu) {
  margin-bottom: 0;
}
:deep(.ant-menu-dark .ant-menu-submenu .ant-menu-item) {
  margin-left: 8px;
  border-radius: 6px;
}
:deep(.ant-menu-dark .ant-menu-submenu .ant-menu-item-selected) {
  background: #e3f2fd !important;
}
:deep(.ant-layout-sider-collapsed) .sidebar-title {
  display: none;
}
:deep(.ant-layout-sider-collapsed) .logo-area {
  justify-content: center;
}
:deep(.ant-layout-sider-collapsed) .sidebar-logo {
  height: 32px;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title {
  position: relative;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item:hover,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title:hover {
  background: #e3f2fd !important;
  color: #1565c0 !important;
  z-index: 10;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item:hover a,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title:hover {
  color: #1565c0 !important;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item .anticon,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title .anticon {
  color: #1976d2;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item:hover .anticon,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title:hover .anticon {
  color: #1565c0;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item span,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title span {
  display: block;
  position: absolute;
  left: 60px;
  top: 50%;
  transform: translateY(-50%);
  min-height: 36px;
  background: #1976d2;
  color: #fff;
  padding: 8px 22px;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(25, 118, 210, 0.18);
  border: none;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  z-index: 2000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s, background 0.18s, color 0.18s, box-shadow 0.18s;
}
:deep(.ant-layout-sider-collapsed) .ant-menu-item:hover span,
:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title:hover span {
  opacity: 1;
  pointer-events: auto;
}
.sidebar-toggle-area {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0 18px 0;
  background: transparent;
  position: absolute;
  left: 0;
  bottom: 0;
  z-index: 10;
}
.sidebar-toggle {
  color: #1976d2;
  font-size: 1.4em;
  background: none;
  border: none;
  box-shadow: none;
  z-index: 2;
  transition: color 0.2s;
}
.sidebar-toggle:hover {
  color: #1565c0;
}
</style>
