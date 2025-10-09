<template>
  <a-layout-sider
    collapsible
    v-model:collapsed="collapsed"
    :trigger="null"
    theme="dark"
    class="app-sidebar-component dark-sidebar"
    :width="sidebarWidth"
    :collapsedWidth="64"
    :style="{ width: collapsed ? '64px' : sidebarWidth + 'px' }"
  >
    <div class="sidebar-inner">
      <div class="logo-area" :class="{ collapsed: collapsed }">
        <router-link to="/" class="logo-link">
          <img
            src="../../assets/logo.png"
            alt="Company Logo"
            class="sidebar-logo"
          />
        </router-link>
      </div>
      <a-menu
        :theme="'light'"
        mode="inline"
        class="menu-list"
        :inline-collapsed="collapsed"
      >
        <div class="menu-group-title" v-if="!collapsed && canViewDashboard">
          {{ $t("sidebarGroup.dashboard") }}
        </div>
        <a-menu-item
          key="dashboard"
          v-if="canViewDashboard"
          :title="$t('dashboard')"
        >
          <router-link to="/dashboard">
            <dashboard-outlined />
            <span>{{ $t("dashboard") }}</span>
          </router-link>
        </a-menu-item>
        <a-menu-item
          key="audit-log"
          v-if="canViewDashboard"
          :title="$t('auditLog')"
        >
          <router-link to="/dashboard/audit-log">
            <audit-outlined />
            <span>Audit Log</span>
          </router-link>
        </a-menu-item>

        <!-- 2. My Area (Sub-menu) -->
        <div class="menu-group-title" v-if="!collapsed">
          {{ $t("sidebarGroup.myArea") }}
        </div>
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
          <a-menu-item key="personal-goals" :title="$t('personalGoalMenu')">
            <router-link to="/personal-goals">
              <check-square-outlined />
              <span>{{ $t("personalGoalMenu") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="my-kpi-self-review" :title="$t('myKpiSelfReview')">
            <router-link to="/my-kpi-self-review">
              <form-outlined />
              <span>{{ $t("myKpiReview") }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>

        <div
          class="menu-group-title"
          v-if="!collapsed && canViewKpiManagementSubMenu"
        >
          {{ $t("sidebarGroup.kpi") }}
        </div>
        <a-sub-menu
          key="kpi-management"
          v-if="canViewKpiManagementSubMenu"
          :title="$t('kpiManagement')"
        >
          <template #title>
            <appstore-outlined />
            <span>{{ $t("kpiManagement") }}</span>
          </template>
          <a-menu-item
            key="kpis-company"
            v-if="canViewCompanyLevel"
            :title="$t('companyKpiList')"
          >
            <router-link to="/kpis/company">
              <global-outlined />
              <span>{{ $t("companyKpiList") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="kpis-department"
            v-if="canViewDepartmentLevel"
            :title="$t('departmentKpiList')"
          >
            <router-link to="/kpis/department">
              <apartment-outlined />
              <span>{{ $t("departmentKpiList") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="kpis-section"
            v-if="canViewSectionLevel"
            :title="$t('sectionKpiList')"
          >
            <router-link to="/kpis/section">
              <cluster-outlined />
              <span>{{ $t("sectionKpiList") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="kpis-inactive"
            v-if="canViewInactiveKpiList"
            :title="$t('inactiveKpiList')"
          >
            <router-link to="/kpis/inactive">
              <appstore-outlined />
              <span>{{ $t("inactiveKpiList") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="kpis-employee-management"
            v-if="canViewKpiEmployeeLevel"
            :title="$t('employeeKpiManagement')"
          >
            <router-link to="/kpis/employee-management">
              <team-outlined />
              <span>{{ $t("employeeKpiManagement") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="personal-goals-employee-management"
            v-if="canViewKpiEmployeeLevel || canViewAdminMenu"
            :title="$t('personalGoal.employeeGoalManagement')"
          >
            <router-link to="/personal-goals/employee-management">
              <team-outlined />
              <span>{{ $t("personalGoal.employeeGoalManagement") }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>
        <div
          class="menu-group-title"
          v-if="!collapsed && canViewApprovalsReviewSubMenu"
        >
          {{ $t("sidebarGroup.approval") }}
        </div>
        <a-sub-menu
          key="approvals-reviews"
          v-if="canViewApprovalsReviewSubMenu"
          :title="$t('approvalsAndReviews')"
        >
          <template #title>
            <audit-outlined />
            <span>{{ $t("approvalsAndReviews") }}</span>
          </template>
          <a-menu-item
            key="approvals"
            v-if="canViewApprovals"
            :title="$t('kpiApproval')"
          >
            <router-link to="/approvals">
              <check-square-outlined />
              <span>{{ $t("kpiApproval") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="performance-objective-approvals"
            v-if="canViewPerformanceObjectiveApprovals"
            :title="$t('performanceObjectiveApprovalMenu')"
          >
            <router-link to="/performance-objective-approvals">
              <file-protect-outlined />
              <span>{{ $t("performanceObjectiveApprovalMenu") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="kpi-review-list"
            v-if="canViewKpiReview"
            :title="$t('kpiReviewTitle')"
          >
            <router-link to="/kpi-review">
              <solution-outlined />
              <span>{{ $t("kpiReviewTitle") }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>
        <div class="menu-group-title" v-if="!collapsed && canViewEmployeeList">
          {{ $t("sidebarGroup.employee") }}
        </div>
        <a-menu-item
          key="employees"
          v-if="canViewEmployeeList"
          :title="$t('employeeList')"
        >
          <router-link to="/employees">
            <team-outlined />
            <span>{{ $t("employeeList") }}</span>
          </router-link>
        </a-menu-item>
        <div class="menu-group-title" v-if="!collapsed && canViewReport">
          {{ $t("sidebarGroup.report") }}
        </div>
        <a-menu-item
          key="report-generator"
          v-if="canViewReport"
          :title="$t('reportGenerator')"
        >
          <router-link to="/report-generator">
            <bar-chart-outlined />
            <span>{{ $t("reportGenerator") }}</span>
          </router-link>
        </a-menu-item>
        <div class="menu-group-title" v-if="!collapsed && canViewAdminMenu">
          {{ $t("sidebarGroup.admin") }}
        </div>
        <a-sub-menu
          key="admin"
          v-if="canViewAdminMenu"
          :title="$t('administration')"
        >
          <template #title>
            <setting-outlined />
            <span>{{ $t("administration") }}</span>
          </template>
          <a-menu-item key="admin-users" :title="$t('addRole')">
            <router-link to="/admin/create-role">
              <usergroup-add-outlined />
              <span>{{ $t("addRole") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-roles" :title="$t('roleManagement')">
            <router-link to="/user-role-manager">
              <key-outlined />
              <span>{{ $t("roleManagement") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="admin-review-cycles"
            :title="$t('reviewCycleManagement')"
          >
            <router-link to="/review-cycle/create">
              <form-outlined />
              <span>{{ $t("reviewCycleManagement") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="admin-create-perspective"
            :title="$t('createPerspective')"
          >
            <router-link to="/perspectives/create">
              <cluster-outlined />
              <span>{{ $t("createPerspective") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="admin-create-department"
            :title="$t('createDepartment')"
          >
            <router-link to="/admin/create-department">
              <apartment-outlined />
              <span>{{ $t("createDepartment") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-create-section" :title="$t('createSection')">
            <router-link to="/admin/create-section">
              <cluster-outlined />
              <span>{{ $t("createSection") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="admin-formula-management"
            :title="$t('formulaManagement')"
          >
            <router-link to="/admin/formula-management">
              <appstore-outlined />
              <span>{{ $t("formulaManagement") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item key="admin-competency" :title="$t('skillManagement')">
            <router-link to="/competencies">
              <appstore-outlined />
              <span>{{ $t("skillManagement") }}</span>
            </router-link>
          </a-menu-item>
          <a-menu-item
            key="admin-employee-skill"
            :title="$t('employeeSkill.title')"
          >
            <router-link to="/employee-skill">
              <appstore-outlined />
              <span>{{ $t("employeeSkill.title") }}</span>
            </router-link>
          </a-menu-item>
        </a-sub-menu>
        <div
          class="menu-group-title"
          v-if="!collapsed && canViewStrategicObjectives"
        >
          {{ $t("sidebarGroup.strategic") }}
        </div>
        <a-menu-item
          key="strategic-objectives"
          v-if="canViewStrategicObjectives"
        >
          <router-link to="/strategic-objectives">
            <appstore-outlined />
            <span>{{ $t("strategicObjectives") }}</span>
          </router-link>
        </a-menu-item>
        <div class="menu-group-title" v-if="!collapsed">
          {{ $t("sidebarGroup.documents") || "Documents & Guides" }}
        </div>
        <a-menu-item
          key="documents"
          :title="$t('documents.title') || 'Documents & Guides'"
        >
          <router-link to="/documents">
            <file-text-outlined />
            <span>{{ $t("documents.title") || "Documents & Guides" }}</span>
          </router-link>
        </a-menu-item>
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
    <!-- Resize Handle -->
    <div v-if="!collapsed" class="resize-handle" @mousedown="startResize"></div>
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
  ProfileOutlined,
  FileTextOutlined,
} from "@ant-design/icons-vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const store = useStore();
const collapsed = ref(false);
const sidebarWidth = ref(220);
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);

function toggleSidebar() {
  collapsed.value = !collapsed.value;
}

function startResize(e) {
  isResizing.value = true;
  startX.value = e.clientX;
  startWidth.value = sidebarWidth.value;

  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  e.preventDefault();
}

function handleResize(e) {
  if (!isResizing.value) return;

  const deltaX = e.clientX - startX.value;
  const newWidth = startWidth.value + deltaX;

  const minWidth = 180;
  const maxWidth = 400;

  if (newWidth >= minWidth && newWidth <= maxWidth) {
    sidebarWidth.value = newWidth;
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
}

const user = computed(() => store.getters["auth/user"]);

const userPermissions = computed(() => user.value?.permissions || []);

function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === resource &&
      (scope ? p.scope?.trim() === scope : true)
  );
}

function hasKpiScopePermission(action, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === RBAC_RESOURCES.KPI &&
      p.scope === scope
  );
}

function hasApprovalScopePermission(action, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_VALUE &&
      p.scope === scope
  );
}

function hasKpiReviewScopePermission(action, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_REVIEW &&
      p.scope === scope
  );
}

const canViewDashboard = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD)
);
const canViewCompanyLevel = computed(() =>
  hasKpiScopePermission(RBAC_ACTIONS.VIEW, "company")
);
const canViewDepartmentLevel = computed(() =>
  hasKpiScopePermission(RBAC_ACTIONS.VIEW, "department")
);
const canViewSectionLevel = computed(() =>
  hasKpiScopePermission(RBAC_ACTIONS.VIEW, "section")
);

const canViewInactiveKpiList = computed(() =>
  hasKpiScopePermission(RBAC_ACTIONS.VIEW, "company")
);

const canViewEmployeeList = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, "employee", "company")
);

const canViewApprovals = computed(() =>
  ["section", "department", "manager"].some((scope) =>
    hasApprovalScopePermission(RBAC_ACTIONS.VIEW, scope)
  )
);

const canViewReport = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.REPORT)
);

const canViewKpiReview = computed(() =>
  ["section", "department", "manager"].some((scope) =>
    hasKpiReviewScopePermission(RBAC_ACTIONS.VIEW, scope)
  )
);

const canViewKpiEmployeeLevel = computed(() =>
  hasKpiScopePermission(RBAC_ACTIONS.VIEW, "employee")
);

const canViewAdminMenu = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN)
);

const canViewStrategicObjectives = computed(
  () => () => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD)
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
.logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: opacity 0.2s;
  width: 100%;
  height: 100%;
}
.logo-link:hover {
  opacity: 0.8;
}
.sidebar-logo {
  height: 38px;
  max-width: 90%;
  margin: 0 auto;
  display: block;
  object-fit: contain;
  transition:
    height 0.2s,
    margin 0.2s;
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
  /* Đảm bảo không bị che bởi toggle-area */
  margin-bottom: 56px; /* Thêm khoảng trống phía dưới cho toggle button */
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
  z-index: 20;
  /* Thêm nền mờ để tránh chữ menu bị lẫn với nút */
  background: linear-gradient(0deg, #fff 80%, #e3f2fd00 100%);
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
  transition:
    background 0.2s,
    color 0.2s;
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

/* Resize Handle Styles */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  background: transparent;
  cursor: col-resize;
  z-index: 1000;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.resize-handle:active {
  background: rgba(255, 255, 255, 0.2);
}

/* Ensure sidebar is positioned relatively for absolute positioning of resize handle */
.app-sidebar-component {
  position: relative;
}
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
  transition:
    opacity 0.18s,
    background 0.18s,
    color 0.18s,
    box-shadow 0.18s;
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
  z-index: 20;
  /* Thêm nền mờ để tránh chữ menu bị lẫn với nút */
  background: linear-gradient(0deg, #fff 80%, #e3f2fd00 100%);
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
