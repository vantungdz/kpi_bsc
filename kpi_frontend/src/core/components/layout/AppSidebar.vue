<template>
  <a-layout-sider collapsible theme="light" class="app-sidebar-component">
    <div class="logo-area">
      <img src="../../assets/logo.png" :alt="$t('logoAlt')" class="sidebar-logo" />
    </div>

    <a-menu theme="light" mode="inline" class="menu-list">
      <!-- 1. Dashboard -->
      <a-menu-item key="dashboard" v-if="canViewDashboard" :title="$t('dashboard')">
        <router-link to="/dashboard">
          <dashboard-outlined />
          <span>{{ $t("dashboard") }}</span>
        </router-link>
      </a-menu-item>

      <!-- 2. My Area (Sub-menu) -->
      <a-sub-menu key="my-area" v-if="canViewMyAreaSubMenu" :title="$t('myArea')">
        <template #title>
          <span>
            <user-outlined />
            <span>{{ $t("myArea") }}</span>
          </span>
        </template>
        <a-menu-item key="personal-kpis" v-if="hasPermission('view', 'kpi_personal')" :title="$t('myPersonalKpis')">
          <router-link to="/personal">
            <profile-outlined />
            <span>{{ $t("myPersonalKpis") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="my-review" v-if="hasPermission('view', 'my_kpi_review')" :title="$t('myKpiReview')">
          <router-link to="/my-kpi-review">
            <form-outlined />
            <span>{{ $t("myKpiReview") }}</span>
          </router-link>
        </a-menu-item>
      </a-sub-menu>

      <!-- 3. KPI Management (Sub-menu) -->
      <a-sub-menu key="kpi-management" v-if="canViewKpiManagementSubMenu" :title="$t('kpiManagement')">
        <template #title>
          <span>
            <appstore-outlined />
            <span>{{ $t("kpiManagement") }}</span>
          </span>
        </template>
        <a-menu-item key="kpis-company" v-if="canViewCompanyLevel" :title="$t('companyKpiList')">
          <router-link to="/kpis/company">
            <global-outlined />
            <span>{{ $t("companyKpiList") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="kpis-department" v-if="canViewDepartmentLevel" :title="$t('departmentKpiList')">
          <router-link to="/kpis/department">
            <apartment-outlined />
            <span>{{ $t("departmentKpiList") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="kpis-section" v-if="canViewSectionLevel" :title="$t('sectionKpiList')">
          <router-link to="/kpis/section">
            <cluster-outlined />
            <span>{{ $t("sectionKpiList") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="kpis-inactive" v-if="canViewSectionLevel" :title="$t('inactiveKpiList')">
          <router-link to="/kpis/inactive">
            <appstore-outlined />
            <span>{{ $t("inactiveKpiList") }}</span>
          </router-link>
        </a-menu-item>
      </a-sub-menu>

      <!-- 4. Approvals & Reviews (Sub-menu) -->
      <a-sub-menu key="approvals-reviews" v-if="canViewApprovalsReviewSubMenu" :title="$t('approvalsAndReviews')">
        <template #title>
          <span>
            <audit-outlined />
            <span>{{ $t("approvalsAndReviews") }}</span>
          </span>
        </template>
        <a-menu-item key="approvals" v-if="canViewApprovals" :title="$t('kpiApproval')">
          <router-link to="/approvals">
            <check-square-outlined />
            <span>{{ $t("kpiApproval") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="performance-objective-approvals" v-if="canViewPerformanceObjectiveApprovals"
          :title="$t('performanceObjectiveApprovalMenu')">
          <router-link to="/performance-objective-approvals">
            <file-protect-outlined />
            <span>{{ $t("performanceObjectiveApprovalMenu") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="evaluation" v-if="canViewKpiReview" :title="$t('evaluation')">
          <router-link to="/kpi/review">
            <solution-outlined />
            <span>{{ $t("evaluation") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="employee-kpi-score-list" v-if="canViewEmployeeKpiScores" :title="$t('employeeKpiScoreList')">
          <router-link to="/employee-kpi-scores">
            <bar-chart-outlined />
            <span>{{ $t("employeeKpiScoreList") }}</span>
          </router-link>
        </a-menu-item>
      </a-sub-menu>

      <!-- 5. Employees -->
      <a-menu-item key="employees" v-if="canViewEmployeeList" :title="$t('employeeList')">
        <router-link to="/employees">
          <team-outlined />
          <span>{{ $t("employeeList") }}</span>
        </router-link>
      </a-menu-item>

      <!-- 6. Report Generator -->
      <a-menu-item key="report-generator" v-if="canViewReport" :title="$t('reportGenerator')">
        <router-link to="/report-generator">
          <bar-chart-outlined />
          <span>{{ $t("reportGenerator") }}</span>
        </router-link>
      </a-menu-item>

      <a-sub-menu key="admin" v-if="canViewAdminMenu" :title="$t('administration')">
        <template #title>
          <span><setting-outlined /><span>{{ $t("administration") }}</span></span>
        </template>
        <a-menu-item key="admin-users" :title="$t('userManagement')">
          <router-link to="/admin/users">
            <usergroup-add-outlined />
            <!-- Added icon -->
            <span>{{ $t("userManagement") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="admin-roles" :title="$t('roleManagement')">
          <router-link to="/user-role-manager">
            <key-outlined />
            <!-- Added icon -->
            <span>{{ $t("roleManagement") }}</span>
          </router-link>
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
  </a-layout-sider>
</template>

<script setup>

import { computed } from "vue";

import { useStore } from "vuex";

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
  FileProtectOutlined,
  AppstoreOutlined, 
  ProfileOutlined, 
  FormOutlined, 
  UsergroupAddOutlined, 
  KeyOutlined, 
} from "@ant-design/icons-vue";

import { RBAC_ACTIONS, RBAC_RESOURCES } from '@/core/constants/rbac.constants';

const store = useStore();


const userPermissions = computed(() => store.getters["auth/user"]?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action?.trim() === action && p.resource?.trim() === resource
  );
}


const canViewDashboard = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD));
const canViewCompanyLevel = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_COMPANY));
const canViewDepartmentLevel = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_DEPARTMENT));
const canViewSectionLevel = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_SECTION));
const canViewEmployeeList = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE));
const canViewApprovals = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.APPROVAL));
const canViewObjectiveApprovals = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.OBJECTIVE_APPROVAL));
const canViewReport = computed(() => hasPermission('export', RBAC_RESOURCES.REPORT_GENERATOR));
const canViewPerformanceObjectiveApprovals = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.PERFORMANCE_OBJECTIVE_APPROVAL));
const canViewKpiReview = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW));
const canViewEmployeeKpiScores = computed(() => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE_KPI_SCORES));
const canViewMyAreaSubMenu = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_PERSONAL) || hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.MY_KPI_REVIEW)
);

const canViewAdminMenu = computed(() =>
  hasPermission(RBAC_ACTIONS.MANAGE, RBAC_RESOURCES.ADMIN) ||
  hasPermission(RBAC_ACTIONS.MANAGE, 'role') ||
  hasPermission(RBAC_ACTIONS.MANAGE, 'user')
);

const canViewKpiManagementSubMenu = computed(
  () =>
    canViewCompanyLevel.value ||
    canViewDepartmentLevel.value ||
    canViewSectionLevel.value
);

const canViewApprovalsReviewSubMenu = computed(
  () => canViewApprovals.value || canViewObjectiveApprovals.value
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
