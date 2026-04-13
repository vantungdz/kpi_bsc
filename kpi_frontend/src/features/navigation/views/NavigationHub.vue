<template>
  <div class="navigation-hub">
    <a-card class="hub-hero" :bordered="false">
      <div class="hub-header">
        <div>
          <div class="hub-kicker">{{ t("navigationHub.sidebarCaption") }}</div>
          <h1>{{ t(sectionConfig.title) }}</h1>
          <p>{{ t(sectionConfig.description) }}</p>
        </div>
      </div>
    </a-card>

    <a-row :gutter="[16, 16]">
      <a-col
        v-for="item in visibleItems"
        :key="item.key"
        :xs="24"
        :md="12"
        :xl="8"
      >
        <a-card class="hub-card" :bordered="false" @click="goTo(item.route)">
          <div v-if="item.count > 0" class="hub-badge">
            <span class="hub-dot"></span>
            <span class="hub-count">{{ item.count }}</span>
          </div>
          <component :is="item.icon" class="hub-icon" />
          <div class="hub-card-title">{{ t(item.label) }}</div>
          <div class="hub-card-description">{{ t(item.description) }}</div>
        </a-card>
      </a-col>
    </a-row>

    <a-empty
      v-if="!visibleItems.length"
      :description="t('navigationHub.empty')"
      class="hub-empty"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  // BellOutlined,
  DashboardOutlined,
  // FileDoneOutlined,
  FileSearchOutlined,
  FormOutlined,
  GlobalOutlined,
  HistoryOutlined,
  InboxOutlined,
  PartitionOutlined,
  SettingOutlined,
  StarOutlined,
  TeamOutlined,
} from "@ant-design/icons-vue";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  SCOPES,
} from "@/core/constants/rbac.constants";
import apiClient from "@/core/services/api";
import {
  getKpiReviewList,
  getReviewCycles,
} from "@/core/services/kpiReviewApi";
import {
  getAssignmentWorkflowSummary,
} from "@/core/utils/workflowTasks";
import {
  buildSystemKpiSettingsNavItems,
  buildSystemPlatformNavItems,
  buildSystemRootHubEntries,
} from "@/core/navigation/systemHubNavItems";

const props = defineProps({
  section: {
    type: String,
    required: true,
  },
});

const router = useRouter();
const store = useStore();
const { t } = useI18n();
const counts = ref({
  personalKpis: 0,
  approvals: 0,
  pendingDefinitionApprovals: 0,
  reviews: 0,
  notifications: 0,
});

const user = computed(() => store.getters["auth/user"]);
const userPermissions = computed(() => user.value?.permissions || []);

function hasPermission(action, resource, scope) {
  return userPermissions.value.some(
    (permission) =>
      permission.action?.trim() === action &&
      permission.resource?.trim() === resource &&
      (scope ? permission.scope?.trim() === scope : true),
  );
}

const canApproveKpiDefinition = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.SECTION) ||
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.DEPARTMENT) ||
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.MANAGER),
);

function pickDefaultCycle(cycles) {
  if (!Array.isArray(cycles) || !cycles.length) return null;

  const today = new Date();
  const activeCycle = cycles.find((cycle) => {
    const start = cycle.startDate ? new Date(cycle.startDate) : null;
    const end = cycle.endDate ? new Date(cycle.endDate) : null;
    return start && end && start <= today && today <= end;
  });

  if (activeCycle) return activeCycle.id;

  return [...cycles]
    .sort((left, right) => {
      const leftTime = new Date(left.endDate || left.startDate || 0).getTime();
      const rightTime = new Date(
        right.endDate || right.startDate || 0,
      ).getTime();
      return rightTime - leftTime;
    })[0]?.id;
}

function getLatestValue(assignment) {
  if (!assignment?.kpiValues?.length) return null;

  return [...assignment.kpiValues].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.timestamp || 0).getTime();
    const rightTime = new Date(
      right.updated_at || right.timestamp || 0,
    ).getTime();
    return rightTime - leftTime;
  })[0];
}

async function loadWorkCounts() {
  if (props.section !== "work") return;
  if (!store.getters["auth/isAuthenticated"]) return;

  try {
    const cycles = await getReviewCycles();
    if (!store.getters["auth/isAuthenticated"]) return;
    const selectedCycle = pickDefaultCycle(cycles);
    const [assignmentsResponse, approvalsResponse, unreadCount] =
      await Promise.all([
        apiClient.get("/kpis/my-assignments", {
          params: { limit: 1000, cycle: selectedCycle || undefined },
        }),
        apiClient.get("/kpi-values/pending-approvals", {
          params: { groupBy: "employee", includeReview: "true" },
        }),
        store.dispatch("notifications/fetchUnreadCount").catch(() => 0),
      ]);

    const assignments =
      assignmentsResponse.data?.data || assignmentsResponse.data || [];
    counts.value.personalKpis = assignments.filter((kpi) => {
      const assignment = Array.isArray(kpi?.assignments)
        ? kpi.assignments.find(
            (item) => item.assigned_to_employee === user.value?.id,
          ) || kpi.assignments[0]
        : null;
      const status = getLatestValue(assignment)?.status || "NOT_SUBMIT";
      return getAssignmentWorkflowSummary(status, t).bucket === "action";
    }).length;

    const approvalGroups = approvalsResponse.data || [];
    counts.value.approvals = approvalGroups.reduce(
      (total, group) => total + Number(group.totalKpis || group.kpiValues?.length || 0),
      0,
    );
    counts.value.notifications = Number(unreadCount || 0);

    let pendingDefCount = 0;
    if (canApproveKpiDefinition.value) {
      try {
        const pendingDefRes = await apiClient.get("/kpis/pending-approval");
        const list = Array.isArray(pendingDefRes.data) ? pendingDefRes.data : [];
        pendingDefCount = list.length;
      } catch {
        pendingDefCount = 0;
      }
    }
    counts.value.pendingDefinitionApprovals = pendingDefCount;

    if (
      selectedCycle &&
      (
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, SCOPES.SECTION) ||
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, SCOPES.DEPARTMENT) ||
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, SCOPES.MANAGER)
      )
    ) {
      const reviews = await getKpiReviewList({ cycle: selectedCycle });
      counts.value.reviews = (reviews || []).filter((review) =>
        [
          "SELF_REVIEWED",
          "SECTION_REVIEWED",
          "DEPARTMENT_REVIEWED",
          "PENDING_MANAGER_APPROVAL",
        ].includes(review.status),
      ).length;
    } else {
      counts.value.reviews = 0;
    }
  } catch (error) {
    counts.value = {
      personalKpis: 0,
      approvals: 0,
      pendingDefinitionApprovals: 0,
      reviews: 0,
      notifications: 0,
    };
  }
}

const allItems = computed(() => ({
  work: [
    {
      key: "personal-kpis",
      label: "myPersonalKpis",
      description: "navigationHub.items.personalKpis",
      route: "/personal",
      icon: HistoryOutlined,
      visible: true,
      count: counts.value.personalKpis,
    },
    {
      key: "kpi-inactive",
      label: "inactiveKpiList",
      description: "navigationHub.items.inactiveKpis",
      route: "/kpis/inactive",
      icon: InboxOutlined,
      visible:
        hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.COMPANY) ||
        hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.DEPARTMENT) ||
        hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.SECTION) ||
        hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI, SCOPES.EMPLOYEE),
    },
    {
      key: "kpi-definition-approval",
      label: "kpiDefinitionApproval",
      description: "navigationHub.items.kpiDefinitionApproval",
      route: "/kpis/approval",
      icon: FormOutlined,
      count: counts.value.pendingDefinitionApprovals,
      visible: canApproveKpiDefinition.value,
    },
    {
      key: "approvals",
      label: "kpiValueApproval",
      description: "navigationHub.items.approvals",
      route: "/approvals",
      icon: AuditOutlined,
      count: counts.value.approvals,
      visible:
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE, SCOPES.SECTION) ||
        hasPermission(
          RBAC_ACTIONS.VIEW,
          RBAC_RESOURCES.KPI_VALUE,
          SCOPES.DEPARTMENT,
        ) ||
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE, SCOPES.MANAGER) ||
        hasPermission(
          RBAC_ACTIONS.APPROVE,
          RBAC_RESOURCES.KPI_VALUE,
          SCOPES.SECTION,
        ) ||
        hasPermission(
          RBAC_ACTIONS.APPROVE,
          RBAC_RESOURCES.KPI_VALUE,
          SCOPES.DEPARTMENT,
        ) ||
        hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.MANAGER),
    },
    // {
    //   key: "reviews",
    //   label: "kpiReviewListTitle",
    //   description: "navigationHub.items.reviews",
    //   route: "/kpi-review",
    //   icon: FileDoneOutlined,
    //   count: counts.value.reviews,
    //   visible:
    //     hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, SCOPES.SECTION) ||
    //     hasPermission(
    //       RBAC_ACTIONS.VIEW,
    //       RBAC_RESOURCES.KPI_REVIEW,
    //       SCOPES.DEPARTMENT,
    //     ) ||
    //     hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, SCOPES.MANAGER),
    // },
    // {
    //   key: "notifications",
    //   label: "notifications",
    //   description: "navigationHub.items.notifications",
    //   route: "/notifications",
    //   icon: BellOutlined,
    //   visible: true,
    //   count: counts.value.notifications,
    // },
  ],
  manage: [
    {
      key: "kpi-company",
      label: "companyKpiList",
      description: "companyKpiListDesc",
      route: "/kpis/company",
      icon: GlobalOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.COMPANY),
    },
    {
      key: "kpi-department",
      label: "departmentKpiList",
      description: "departmentKpiListDesc",
      route: "/kpis/department",
      icon: BankOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.DEPARTMENT),
    },
    {
      key: "kpi-section",
      label: "sectionKpiList",
      description: "sectionKpiListDesc",
      route: "/kpis/section",
      icon: PartitionOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.SECTION),
    },
    {
      key: "employee-kpis",
      label: "employeeKpiManagement",
      description: "navigationHub.items.employeeKpis",
      route: "/kpis/employee-management",
      icon: TeamOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.EMPLOYEE),
    },
    {
      key: "personal-goals",
      label: "personalGoal.employeeGoalManagement",
      description: "navigationHub.items.personalGoals",
      route: "/personal-goals/employee-management",
      icon: StarOutlined,
      visible:
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, SCOPES.EMPLOYEE) ||
        hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN),
    },
    {
      key: "competencies",
      label: "skillManagement",
      description: "navigationHub.items.competencies",
      route: "/competencies",
      icon: SettingOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE, SCOPES.COMPANY),
    },
  ],
  reports: [
    {
      key: "dashboard",
      label: "dashboard",
      description: "navigationHub.items.dashboard",
      route: "/dashboard",
      icon: DashboardOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD),
    },
    {
      key: "report-generator",
      label: "reportGenerator",
      description: "navigationHub.items.reportGenerator",
      route: "/report-generator",
      icon: BarChartOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.REPORT),
    },
    {
      key: "audit-log",
      label: "auditLog",
      description: "navigationHub.items.auditLog",
      route: "/dashboard/audit-log",
      icon: FileSearchOutlined,
      visible: hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD),
    },
    {
      key: "strategic",
      label: "strategicObjectives",
      description: "navigationHub.items.strategic",
      route: "/strategic-objectives",
      icon: GlobalOutlined,
      visible: hasPermission(
        RBAC_ACTIONS.VIEW,
        RBAC_RESOURCES.DASHBOARD,
        SCOPES.GLOBAL,
      ),
    },
  ],
  system: buildSystemRootHubEntries(hasPermission),
  systemKpi: buildSystemKpiSettingsNavItems(hasPermission),
  systemPlatform: buildSystemPlatformNavItems(hasPermission),
}));

const sectionConfig = computed(() => ({
  title: `navigationHub.${props.section}.title`,
  description: `navigationHub.${props.section}.description`,
}));

const visibleItems = computed(
  () => allItems.value[props.section]?.filter((item) => item.visible) || [],
);

function goTo(route) {
  router.push(route);
}

onMounted(() => {
  loadWorkCounts();
});

watch(
  () => props.section,
  () => {
    loadWorkCounts();
  },
);
</script>

<style scoped>
.navigation-hub {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hub-hero,
.hub-card {
  border-radius: 20px;
  box-shadow: 0 14px 40px rgba(16, 24, 40, 0.08);
}

.hub-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}

.hub-kicker {
  color: #1565c0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.hub-header h1 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  line-height: 1.2;
  color: #0f172a;
}

.hub-header p {
  margin: 0;
  max-width: 720px;
  color: #475569;
  font-size: 14px;
}

.hub-card {
  min-height: 152px;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
  border: 1px solid #e2e8f0;
  position: relative;
}

.hub-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 42px rgba(16, 24, 40, 0.12);
}

.hub-icon {
  font-size: 22px;
  color: #1976d2;
  margin-bottom: 12px;
}

.hub-card-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 6px;
}

.hub-card-description {
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.hub-badge {
  position: absolute;
  top: 18px;
  right: 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.hub-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.14);
}

.hub-empty {
  padding: 40px 0;
}

@media (max-width: 768px) {
  .hub-header h1 {
    font-size: 1.35rem;
  }
}
</style>
