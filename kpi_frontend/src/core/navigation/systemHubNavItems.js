import {
  BankOutlined,
  CalculatorOutlined,
  CalendarOutlined,
  FileTextOutlined,
  LineChartOutlined,
  PartitionOutlined,
  ReadOutlined,
  SolutionOutlined,
  InboxOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons-vue";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  SCOPES,
} from "@/core/constants/rbac.constants";


export function buildSystemKpiSettingsNavItems(hasPermission) {
  return [
    {
      key: "formula",
      label: "formulaManagement",
      description: "navigationHub.items.formulas",
      route: "/admin/formula-management",
      icon: CalculatorOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN, SCOPES.GLOBAL),
    },
    {
      key: "templates",
      label: "templatesKpiList",
      description: "navigationHub.items.templates",
      route: "/kpis/templates",
      icon: InboxOutlined,
      visible: hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
    },
  ];
}


export function buildSystemPlatformNavItems(hasPermission) {
  return [
    {
      key: "department",
      label: "createDepartment",
      description: "navigationHub.items.departments",
      route: "/admin/create-department",
      icon: BankOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN, SCOPES.GLOBAL),
    },
    {
      key: "section",
      label: "createSection",
      description: "navigationHub.items.sections",
      route: "/admin/create-section",
      icon: PartitionOutlined,
       visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN, SCOPES.GLOBAL),
    },
    {
      key: "employees",
      label: "employeeList",
      description: "navigationHub.items.employees",
      route: "/employees",
      icon: SolutionOutlined,
      visible: hasPermission(
        RBAC_ACTIONS.VIEW,
        RBAC_RESOURCES.EMPLOYEE,
        SCOPES.COMPANY,
      ),
    },
    {
      key: "role-setup",
      label: "addRole",
      description: "navigationHub.items.roleSetup",
      route: "/admin/create-role",
      icon: TeamOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN),
    },
    {
      key: "review-cycle",
      label: "reviewCycleManagement",
      description: "navigationHub.items.reviewCycles",
      route: "/review-cycle/create",
      icon: CalendarOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN),
    },
    {
      key: "documents",
      label: "documents.title",
      description: "navigationHub.items.documents",
      route: "/documents",
      icon: FileTextOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN),
    },
    {
      key: "system-docs",
      label: "systemDocs.title",
      description: "navigationHub.items.systemDocs",
      route: "/system-docs",
      icon: ReadOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN),
    },
  ];
}


export function buildSystemRootHubEntries(hasPermission) {
  const kpi = buildSystemKpiSettingsNavItems(hasPermission);
  const platform = buildSystemPlatformNavItems(hasPermission);
  return [
    {
      key: "system-platform-settings",
      label: "navigationHub.systemPlatform.title",
      description: "navigationHub.systemPlatform.cardLead",
      route: "/system/platform",
      icon: ToolOutlined,
      visible: platform.some((i) => i.visible),
    },
    {
      key: "system-kpi-settings",
      label: "navigationHub.systemKpi.title",
      description: "navigationHub.systemKpi.cardLead",
      route: "/system/kpi-settings",
      icon: LineChartOutlined,
      visible: kpi.some((i) => i.visible),
    },
  ];
}

/**
 * Match route → key dùng cho selectedKeys menu System (sidebar).
 * @param {(action: string, resource: string, scope?: string) => boolean} hasPermission
 */
export function resolveSystemSidebarMenuKey(path, hasPermission) {
  const kpiItems = buildSystemKpiSettingsNavItems(hasPermission).filter(
    (i) => i.visible,
  );
  const platItems = buildSystemPlatformNavItems(hasPermission).filter(
    (i) => i.visible,
  );

  const matchers = [];
  for (const it of kpiItems) {
    matchers.push({ key: "system-kpi-settings", route: it.route });
  }
  for (const it of platItems) {
    matchers.push({ key: "system-platform-settings", route: it.route });
  }
  matchers.push(
    { key: "system-kpi-settings", route: "/system/kpi-settings" },
    { key: "system-platform-settings", route: "/system/platform" },
    { key: "system-root", route: "/system" },
  );
  matchers.sort((a, b) => b.route.length - a.route.length);

  for (const entry of matchers) {
    if (path === entry.route || path.startsWith(`${entry.route}/`)) {
      return entry.key;
    }
  }
  return "system-root";
}
