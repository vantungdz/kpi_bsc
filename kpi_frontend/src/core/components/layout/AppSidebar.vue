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
      <div class="logo-area" :class="{ collapsed }">
        <router-link to="/my-tasks" class="logo-link">
          <img
            src="../../assets/logo.png"
            alt="Company Logo"
            class="sidebar-logo"
          />
        </router-link>
      </div>

      <div class="menu-caption" v-if="!collapsed">
        {{ $t("navigationHub.sidebarCaption") }}
      </div>

      <a-menu
        theme="light"
        mode="inline"
        class="menu-list"
        :inline-collapsed="collapsed"
        v-model:openKeys="openKeys"
        :selectedKeys="selectedKeys"
      >
        <a-menu-item
          v-for="item in visibleFlatMenuItems"
          :key="item.key"
          :title="$t(item.label)"
        >
          <router-link :to="item.route">
            <component :is="item.icon" />
            <span>{{ $t(item.label) }}</span>
          </router-link>
        </a-menu-item>
        <a-sub-menu v-if="systemSubmenuEntry">
          <template #title>
            <span class="sidebar-submenu-title">
              <component :is="systemSubmenuEntry.icon" />
              <span>{{ $t(systemSubmenuEntry.label) }}</span>
            </span>
          </template>
          <a-menu-item
            v-for="child in systemSubmenuEntry.children"
            :key="child.key"
            :title="$t(child.label)"
          >
            <router-link :to="child.route">
              <component :is="child.icon" v-if="child.icon" />
              <span>{{ $t(child.label) }}</span>
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
    <div
      v-if="!collapsed"
      class="resize-handle"
      @mousedown="startResize"
    ></div>
  </a-layout-sider>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import {
  LayoutSider as ALayoutSider,
  Menu as AMenu,
  MenuItem as AMenuItem,
  SubMenu as ASubMenu,
  Button as AButton,
} from "ant-design-vue";
import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  SettingOutlined,
} from "@ant-design/icons-vue";
import {
  buildSystemRootHubEntries,
  resolveSystemSidebarMenuKey,
} from "@/core/navigation/systemHubNavItems";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  SCOPES,
} from "@/core/constants/rbac.constants";

const store = useStore();
const route = useRoute();

const collapsed = ref(false);
const sidebarWidth = ref(240);
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);
const selectedKeys = ref([]);
const openKeys = ref([]);

const user = computed(() => store.getters["auth/user"]);
const userPermissions = computed(() => user.value?.permissions || []);

function toggleSidebar() {
  collapsed.value = !collapsed.value;
}

function startResize(event) {
  isResizing.value = true;
  startX.value = event.clientX;
  startWidth.value = sidebarWidth.value;

  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  event.preventDefault();
}

function handleResize(event) {
  if (!isResizing.value) return;

  const deltaX = event.clientX - startX.value;
  const newWidth = startWidth.value + deltaX;
  if (newWidth >= 180 && newWidth <= 320) {
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

function hasPermission(action, resource, scope) {
  return userPermissions.value.some(
    (permission) =>
      permission.action?.trim() === action &&
      permission.resource?.trim() === resource &&
      (scope ? permission.scope?.trim() === scope : true),
  );
}

const canAccessWorkspace = computed(() => true);

const canAccessManage = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.COMPANY) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.DEPARTMENT) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.SECTION) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.EMPLOYEE),
);

const canAccessReports = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.REPORT) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD, SCOPES.GLOBAL),
);

const canAccessSystem = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN, SCOPES.GLOBAL) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE, SCOPES.COMPANY),
);

const menuItems = computed(() => [
  {
    key: "my-tasks",
    label: "myTasks",
    route: "/my-tasks",
    icon: ProfileOutlined,
    visible: true,
  },
  {
    key: "workspace",
    label: "navigationHub.work.title",
    route: "/workspace",
    icon: AppstoreOutlined,
    visible: canAccessWorkspace.value,
  },
  {
    key: "manage",
    label: "navigationHub.manage.title",
    route: "/manage",
    icon: AuditOutlined,
    visible: canAccessManage.value,
  },
  {
    key: "reports",
    label: "navigationHub.reports.title",
    route: "/reports",
    icon: BarChartOutlined,
    visible: canAccessReports.value,
  },
  {
    key: "system",
    label: "navigationHub.system.title",
    route: "/system",
    icon: SettingOutlined,
    visible: canAccessSystem.value,
  },
]);

function isSystemSectionPath(path) {
  return (
    path.startsWith("/system") ||
    path.startsWith("/user-role-manager") ||
    path.startsWith("/admin/") ||
    path.startsWith("/review-cycle") ||
    path.startsWith("/perspectives") ||
    path.startsWith("/documents") ||
    path.startsWith("/system-docs") ||
    path.startsWith("/employees")
  );
}

const visibleTopLevelMenuItems = computed(() => {
  const out = [];
  for (const item of menuItems.value) {
    if (!item.visible) continue;
    if (item.key === "system") {
      const children = buildSystemRootHubEntries(hasPermission).filter(
        (c) => c.visible,
      );
      if (children.length === 0) {
        out.push({
          type: "item",
          key: "system",
          label: item.label,
          route: "/system",
          icon: item.icon,
          visible: true,
        });
      } else {
        out.push({
          type: "submenu",
          key: "system",
          label: item.label,
          icon: item.icon,
          children,
        });
      }
    } else {
      out.push({ type: "item", ...item });
    }
  }
  return out;
});

const visibleFlatMenuItems = computed(() =>
  visibleTopLevelMenuItems.value.filter((entry) => entry.type === "item"),
);

const systemSubmenuEntry = computed(
  () =>
    visibleTopLevelMenuItems.value.find((entry) => entry.type === "submenu") ||
    null,
);

function resolveSelectedMenuKey(path) {
  if (path.startsWith("/my-tasks")) return "my-tasks";
  if (
    path.startsWith("/workspace") ||
    path.startsWith("/personal") ||
    path.startsWith("/my-kpi-self-review") ||
    path.startsWith("/approvals") ||
    path.startsWith("/kpis/approval") ||
    path.startsWith("/kpi-review") ||
    path.startsWith("/notifications")
  ) {
    return "workspace";
  }
  if (
    path.startsWith("/manage") ||
    path.startsWith("/kpis/company") ||
    path.startsWith("/kpis/department") ||
    path.startsWith("/kpis/section") ||
    path.startsWith("/kpis/templates") ||
    path.startsWith("/kpis/inactive") ||
    path.startsWith("/kpis/employee-management") ||
    path.startsWith("/competencies") ||
    path.startsWith("/employee-skill") ||
    path.startsWith("/personal-goals")
  ) {
    return "manage";
  }
  if (
    path.startsWith("/reports") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/report-generator") ||
    path.startsWith("/strategic-objectives")
  ) {
    return "reports";
  }
  if (isSystemSectionPath(path)) {
    return resolveSystemSidebarMenuKey(path, hasPermission);
  }
  return "my-tasks";
}

watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [resolveSelectedMenuKey(path)];
    if (!collapsed.value && isSystemSectionPath(path) && canAccessSystem.value) {
      if (!openKeys.value.includes("system")) {
        openKeys.value = [...openKeys.value, "system"];
      }
    }
  },
  { immediate: true },
);

watch(collapsed, (isCollapsed) => {
  if (isCollapsed) {
    openKeys.value = [];
  } else if (
    isSystemSectionPath(route.path) &&
    canAccessSystem.value &&
    !openKeys.value.includes("system")
  ) {
    openKeys.value = [...openKeys.value, "system"];
  }
});
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

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

.logo-area {
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-bottom: 1px solid #e0e6f6;
  background: #e3f2fd;
}

.logo-area.collapsed {
  justify-content: center;
}

.logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  width: 100%;
  height: 100%;
}

.sidebar-logo {
  height: 38px;
  max-width: 90%;
  object-fit: contain;
}

.menu-caption {
  color: #1565c0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 18px 18px 8px;
}

.menu-list {
  background: transparent;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important;
  padding-top: 8px;
  margin-bottom: 56px;
}

.sidebar-toggle-area {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0 18px;
  position: absolute;
  left: 0;
  bottom: 0;
  z-index: 20;
  background: linear-gradient(0deg, #fff 80%, #e3f2fd00 100%);
}

.sidebar-toggle {
  color: #1976d2;
  font-size: 1.4em;
  background: none;
  border: none;
  box-shadow: none;
}

.sidebar-toggle:hover {
  color: #1565c0;
}

:deep(.ant-menu-light .ant-menu-item) {
  border-radius: 10px;
  margin: 0 10px 8px;
  padding: 0 12px !important;
  height: 46px;
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #1976d2;
  background: transparent;
}

:deep(.ant-menu-light .ant-menu-item a) {
  color: inherit;
}

:deep(.ant-menu-light .ant-menu-item-selected),
:deep(.ant-menu-light .ant-menu-item-active) {
  background: #e3f2fd !important;
  color: #1565c0 !important;
}

:deep(.ant-menu-light .ant-menu-item .anticon) {
  font-size: 18px;
  margin-right: 10px;
  color: inherit;
}

.sidebar-submenu-title {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

.sidebar-submenu-title .anticon {
  font-size: 18px;
  margin-right: 10px;
  color: inherit;
}

:deep(.ant-menu-light .ant-menu-submenu-title) {
  border-radius: 10px;
  margin: 0 10px 8px;
  padding: 0 12px !important;
  height: 46px;
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #1976d2;
}

:deep(.ant-menu-light .ant-menu-submenu-open > .ant-menu-submenu-title),
:deep(.ant-menu-light .ant-menu-submenu-selected > .ant-menu-submenu-title),
:deep(.ant-menu-light .ant-menu-submenu-active > .ant-menu-submenu-title) {
  color: #1565c0 !important;
}

/* Child items under System (submenu): indent so they are not flush with top-level items */
:deep(.ant-menu-light .ant-menu-submenu .ant-menu-item) {
  margin: 0 10px 6px 12px !important;
  padding: 0 12px 0 22px !important;
  height: 42px;
  font-size: 14px;
  font-weight: 500;
}

:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title .anticon + span {
  display: none;
}

:deep(.ant-layout-sider-collapsed) .ant-menu-submenu-title {
  padding: 0 calc(50% - 9px) !important;
}

:deep(.ant-layout-sider-collapsed) .ant-menu-item {
  position: relative;
}

:deep(.ant-layout-sider-collapsed) .ant-menu-item span {
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
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  z-index: 2000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s;
}

:deep(.ant-layout-sider-collapsed) .ant-menu-item:hover span {
  opacity: 1;
  pointer-events: auto;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  background: transparent;
  cursor: col-resize;
  z-index: 1000;
}

.resize-handle:hover {
  background: rgba(25, 118, 210, 0.15);
}
</style>
