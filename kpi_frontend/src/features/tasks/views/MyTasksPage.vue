<template>
  <div class="my-tasks-page">
    <a-card class="hero-card" :bordered="false">
      <div class="hero-header">
        <div>
          <div class="hero-kicker">{{ t("workflowInbox.control.kicker") }}</div>
          <h1>{{ t("workflowInbox.control.heading") }}</h1>
          <p>{{ t("workflowInbox.control.subheading") }}</p>
        </div>
        <a-button type="primary" @click="refreshAll" :loading="loading">
          {{ t("workflowInbox.refresh") }}
        </a-button>
      </div>

      <a-alert
        v-if="orgContextWarning"
        type="warning"
        show-icon
        :message="orgContextWarning"
        style="margin-top: 12px"
      />

      <a-row :gutter="[12, 12]" class="risk-row">
        <a-col :xs="12" :sm="6">
          <div
            class="risk-tile overdue"
            :class="{ active: pipelineFilter === 'overdue' }"
            @click="togglePipelineFilter('overdue')"
          >
            <div class="risk-value">{{ riskStats.overdue }}</div>
            <div class="risk-label">{{ t("workflowInbox.overview.riskOverdue") }}</div>
            <div class="risk-hint">{{ t("workflowInbox.overview.riskOverdueHint") }}</div>
          </div>
        </a-col>
        <a-col :xs="12" :sm="6">
          <div
            class="risk-tile due-soon"
            :class="{ active: pipelineFilter === 'dueSoon' }"
            @click="togglePipelineFilter('dueSoon')"
          >
            <div class="risk-value">{{ riskStats.dueSoon }}</div>
            <div class="risk-label">{{ t("workflowInbox.overview.riskDueSoon") }}</div>
            <div class="risk-hint">{{ t("workflowInbox.overview.riskDueSoonHint") }}</div>
          </div>
        </a-col>
        <a-col :xs="12" :sm="6">
          <div
            class="risk-tile attention"
            :class="{ active: pipelineFilter === 'attention' }"
            @click="togglePipelineFilter('attention')"
          >
            <div class="risk-value">{{ riskStats.attention }}</div>
            <div class="risk-label">{{ t("workflowInbox.overview.riskAttention") }}</div>
            <div class="risk-hint">{{ t("workflowInbox.overview.riskAttentionHint") }}</div>
          </div>
        </a-col>
        <a-col :xs="12" :sm="6">
          <div
            class="risk-tile approvals clickable-risk"
            role="button"
            tabindex="0"
            @click="goToApprovals"
            @keydown.enter.prevent="goToApprovals"
          >
            <div class="risk-value">{{ riskStats.pendingApprovals }}</div>
            <div class="risk-label">
              {{ t("workflowInbox.overview.riskPendingApprovals") }}
            </div>
            <div class="risk-hint">
              {{ t("workflowInbox.overview.riskPendingApprovalsHint") }}
            </div>
          </div>
        </a-col>
      </a-row>

      <div class="timeline-block">
        <div class="control-title">{{ t("workflow.dashboard.timeline.title") }}</div>
        <div class="control-subtitle">{{ t("workflow.dashboard.timeline.subtitle") }}</div>
        <div class="timeline-track">
          <div
            v-for="node in timelineNodes"
            :key="node.key"
            class="timeline-node"
            :class="[node.tone, { disabled: node.disabled }]"
          >
            <div class="timeline-head">
              <div class="timeline-dot"></div>
              <div class="timeline-node-title">{{ node.title }}</div>
            </div>
            <div class="timeline-node-desc">{{ node.description }}</div>
          </div>
        </div>
        <div class="timeline-status-row">
          <div
            v-for="node in timelineNodes"
            :key="`${node.key}-status`"
            class="timeline-status-item"
            :class="{ disabled: node.disabled }"
          >
            <span v-if="node.disabled">{{ t("workflow.dashboard.timeline.notStart") }}</span>
            <span v-else>
              {{ t("workflow.dashboard.timeline.pendingCount", { count: node.pending }) }}
            </span>
          </div>
        </div>
      </div>

      <a-row :gutter="[16, 16]" class="control-row">
        <a-col :xs="24" :lg="14">
          <div class="control-block">
            <div class="control-title">{{ t("workflow.dashboard.priority.title") }}</div>
            <div class="control-subtitle">
              {{
                t("workflow.dashboard.priority.subtitle", {
                  role: currentRoleLabel,
                })
              }}
            </div>
            <div v-if="priorityActions.length" class="priority-list">
              <div
                v-for="item in priorityActions"
                :key="item.key"
                class="priority-item"
                :class="item.tone"
              >
                <div class="priority-content">
                  <div class="priority-label">{{ item.label }}</div>
                  <div class="priority-desc">{{ item.description }}</div>
                </div>
                <a-button
                  v-if="item.handler && item.actionText"
                  type="link"
                  @click="item.handler"
                >
                  {{ item.actionText }}
                </a-button>
              </div>
            </div>
            <a-empty v-else :description="t('workflow.dashboard.priority.empty')" />
          </div>
        </a-col>
        <a-col :xs="24" :lg="10">
          <div class="control-block">
            <div class="control-title">{{ t("workflow.dashboard.rolePanel.title") }}</div>
            <div class="control-subtitle">
              {{ t("workflow.dashboard.rolePanel.subtitle") }}
            </div>
            <div class="role-kpi-list">
              <div
                v-for="card in roleKpiCards"
                :key="card.key"
                class="role-kpi-card"
                :class="card.tone"
                :role="card.handler ? 'button' : undefined"
                :tabindex="card.handler ? 0 : undefined"
                @click="card.handler && card.handler()"
              >
                <div class="role-kpi-value">{{ card.value }}</div>
                <div class="role-kpi-label">{{ card.label }}</div>
                <div class="role-kpi-hint">{{ card.hint }}</div>
              </div>
            </div>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <a-alert
      v-if="errorMessage"
      type="error"
      show-icon
      :message="errorMessage"
      closable
      @close="errorMessage = ''"
      style="margin-bottom: 16px"
    />

    <a-card class="task-card inbox-card" :bordered="false">
      <div class="inbox-head">
        <div>
          <h2 class="card-title">{{ t("workflowInbox.control.inboxTitle") }}</h2>
          <p class="card-lead">{{ t("workflowInbox.control.inboxLead") }}</p>
        </div>
      </div>
      <div class="inbox-toolbar">
        <a-radio-group
          v-model:value="activeBucket"
          button-style="solid"
          size="small"
        >
          <a-radio-button value="action">
            {{ t("workflowInbox.sections.action") }}
            ({{ actionableTasks.length }})
          </a-radio-button>
          <a-radio-button value="waiting">
            {{ t("workflowInbox.sections.waiting") }}
            ({{ waitingTasks.length }})
          </a-radio-button>
          <a-radio-button value="completed">
            {{ t("workflowInbox.sections.completed") }}
            ({{ completedTasks.length }})
          </a-radio-button>
        </a-radio-group>

        <a-segmented
          v-model:value="viewMode"
          :options="viewModeOptions"
          size="small"
        />
      </div>
      <a-alert
        v-if="viewMode === 'preview'"
        type="info"
        show-icon
        :message="t('workflowInbox.preview.message', { count: previewLimit })"
        style="margin-bottom: 16px"
      />

      <a-spin :spinning="loading">
        <div v-if="visibleTasks.length" class="task-list">
          <div
            v-for="task in visibleTasks"
            :key="task.key"
            class="task-item"
          >
            <div class="task-main">
              <div class="task-topline">
                <a-tag :color="task.tagColor">{{ task.tagLabel }}</a-tag>
                <span class="task-step">{{ task.currentStep }}</span>
              </div>
              <div class="task-title">{{ task.title }}</div>
              <div class="task-subtitle">{{ task.subtitle }}</div>
              <div class="task-next">{{ task.nextAction }}</div>
            </div>
            <a-button
              :type="activeBucket === 'action' ? 'primary' : 'default'"
              @click="openTask(task)"
            >
              {{ task.actionLabel }}
            </a-button>
          </div>
        </div>
        <a-empty
          v-else
          :description="t(`workflowInbox.empty.${activeBucket}`)"
        />
      </a-spin>

      <div
        v-if="activeBucketTasks.length > previewLimit"
        class="inbox-footer"
      >
        <a-button v-if="viewMode === 'preview'" @click="viewMode = 'all'">
          {{
            t("workflowInbox.actions.showAll", {
              count: activeBucketTasks.length,
            })
          }}
        </a-button>
        <a-button v-else @click="viewMode = 'preview'">
          {{
            t("workflowInbox.actions.showLess", {
              count: previewLimit,
            })
          }}
        </a-button>
      </div>
    </a-card>

    <a-card class="task-card pipeline-card" :bordered="false">
      <div class="card-head">
        <div>
          <h2 class="card-title">{{ t("workflowInbox.control.executionTitle") }}</h2>
          <p class="card-lead">{{ t("workflowInbox.control.executionLead") }}</p>
        </div>
        <a-radio-group v-model:value="pipelineFilter" button-style="solid" size="small">
          <a-radio-button value="all">{{ t("workflowInbox.overview.filterAll") }}</a-radio-button>
          <a-radio-button value="overdue">{{
            t("workflowInbox.overview.filterOverdue")
          }}</a-radio-button>
          <a-radio-button value="dueSoon">{{
            t("workflowInbox.overview.filterDueSoon")
          }}</a-radio-button>
          <a-radio-button value="attention">{{
            t("workflowInbox.overview.filterAttention")
          }}</a-radio-button>
        </a-radio-group>
      </div>
      <a-input
        v-model:value="pipelineSearch"
        allow-clear
        class="pipeline-search"
        :placeholder="t('workflowInbox.overview.searchPlaceholder')"
      />

      <a-spin :spinning="loading">
        <a-table
          v-if="filteredPipelineRows.length"
          class="pipeline-table"
          :columns="pipelineColumns"
          :data-source="visiblePipelineRows"
          :pagination="false"
          row-key="key"
          size="middle"
          :scroll="{ x: 1020 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'item'">
              <div class="cell-kpi-name">{{ record.kpiName }}</div>
            </template>
            <template v-else-if="column.key === 'owner'">
              {{ record.ownerLabel }}
            </template>
            <template v-else-if="column.key === 'stage'">
              <a-tag :color="record.stageColor">{{ record.workflowStageLabel }}</a-tag>
            </template>
            <template v-else-if="column.key === 'yourTurn'">
              <span class="cell-your-turn">{{ record.yourTurnLabel }}</span>
            </template>
            <template v-else-if="column.key === 'due'">
              <div>{{ record.dueDateLabel }}</div>
              <div v-if="record.dueRelativeLabel" class="cell-due-sub">
                {{ record.dueRelativeLabel }}
              </div>
            </template>
            <template v-else-if="column.key === 'heat'">
              <a-tag v-if="record.overdue" color="red">{{
                t("workflowInbox.overview.overdueShort")
              }}</a-tag>
              <a-tag v-else-if="record.dueSoon" color="orange">{{
                t("workflowInbox.overview.dueSoonShort")
              }}</a-tag>
              <a-tag v-else-if="record.workflowBucket === 'action'" color="gold">{{
                t("workflowInbox.overview.riskAttention")
              }}</a-tag>
              <a-tag v-else-if="record.isRejected" color="red">{{
                t("workflowInbox.overview.riskBlocked")
              }}</a-tag>
              <a-tag v-else color="green">{{ t("workflowInbox.overview.riskOk") }}</a-tag>
            </template>
            <template v-else-if="column.key === 'open'">
              <span v-if="record.overdue" class="cell-open-disabled">
                Đã quá hạn
              </span>
              <a-button
                v-else
                type="link"
                size="small"
                @click="openRoute(record.route)"
              >
                {{ record.actionLabel }}
              </a-button>
            </template>
          </template>
        </a-table>
        <a-empty v-else :description="t('workflowInbox.overview.emptyPipeline')" />

        <div v-if="filteredPipelineRows.length > pipelinePreviewLimit" class="pipeline-footer">
          <a-button v-if="pipelineShowAll" @click="pipelineShowAll = false">
            {{ t("workflowInbox.actions.showLess", { count: pipelinePreviewLimit }) }}
          </a-button>
          <a-button v-else type="link" @click="pipelineShowAll = true">
            {{ t("workflowInbox.actions.showAll", { count: filteredPipelineRows.length }) }}
          </a-button>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import apiClient from "@/core/services/api";
import { getKpiReviewList, getReviewCycles } from "@/core/services/kpiReviewApi";
import { pickReviewCycleIdFromStore } from "@/core/composables/useReviewCycleGlobalSync";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  SCOPES,
} from "@/core/constants/rbac.constants";
import {
  getAssignmentWorkflowSummary,
  getPendingApprovalStep,
  getReviewWorkflowSummary,
} from "@/core/utils/workflowTasks";

const router = useRouter();
const store = useStore();
const { t } = useI18n();

const loading = ref(false);
const errorMessage = ref("");
const myAssignments = ref([]);
const pendingApprovals = ref([]);
const myReviews = ref([]);
const reviewApprovals = ref([]);
const selectedCycle = ref(null);
const selectedCycleMeta = ref(null);
const activeBucket = ref("action");
const viewMode = ref("preview");
const previewLimit = 5;
const searchText = ref("");
const taskTypeFilter = ref("all");

const overviewKpis = ref([]);
const pipelineSearch = ref("");
const pipelineFilter = ref("all");
const pipelineShowAll = ref(false);
const pipelinePreviewLimit = 15;

const currentUser = computed(() => store.getters["auth/user"]);
const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || [],
);
const selectedCycleLabel = computed(() =>
  selectedCycle.value
    ? t("workflow.review.cycleLabel", { cycle: selectedCycle.value })
    : t("workflow.review.cycleDefault"),
);

const overviewScope = computed(() => {
  if (
    hasPermissionStatic(userPermissions.value, RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, [
      SCOPES.COMPANY,
      SCOPES.GLOBAL,
    ])
  ) {
    return "company";
  }
  if (
    hasPermissionStatic(userPermissions.value, RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, [
      SCOPES.DEPARTMENT,
    ])
  ) {
    return "department";
  }
  if (
    hasPermissionStatic(userPermissions.value, RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI, [
      SCOPES.SECTION,
    ])
  ) {
    return "section";
  }
  return "employee";
});

const currentRoleLabel = computed(() =>
  t(`workflow.dashboard.role.${overviewScope.value}`),
);
const canOpenApprovals = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE, SCOPES.SECTION) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE, SCOPES.DEPARTMENT) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE, SCOPES.MANAGER) ||
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.SECTION) ||
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.DEPARTMENT) ||
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, SCOPES.MANAGER),
);

const orgContextWarning = computed(() => {
  if (overviewScope.value === "section" && !currentUser.value?.sectionId) {
    return t("workflowInbox.overview.noOrgContext");
  }
  if (overviewScope.value === "department" && !currentUser.value?.departmentId) {
    return t("workflowInbox.overview.noOrgContext");
  }
  return "";
});

function hasPermissionStatic(permissions, action, resource, scopes = []) {
  const list = Array.isArray(scopes) ? scopes : [scopes];
  return permissions.some(
    (permission) =>
      permission.action === action &&
      permission.resource === resource &&
      (!list.length || list.includes(permission.scope)),
  );
}

function hasPermission(action, resource, scopes = []) {
  const normalizedScopes = Array.isArray(scopes) ? scopes : [scopes];
  return userPermissions.value.some(
    (permission) =>
      permission.action === action &&
      permission.resource === resource &&
      (!normalizedScopes[0] || normalizedScopes.includes(permission.scope)),
  );
}

function assignmentBelongsToSection(assignment, sectionId) {
  if (!sectionId || !assignment) return false;
  if (
    assignment.assigned_to_section &&
    Number(assignment.assigned_to_section) === Number(sectionId)
  ) {
    return true;
  }
  const sid =
    assignment.employee?.sectionId ??
    assignment.employee?.section?.id ??
    null;
  return sid != null && Number(sid) === Number(sectionId);
}

function assignmentBelongsToDepartment(assignment, departmentId) {
  if (!departmentId || !assignment) return false;
  if (
    assignment.assigned_to_department &&
    Number(assignment.assigned_to_department) === Number(departmentId)
  ) {
    return true;
  }
  const did =
    assignment.employee?.departmentId ??
    assignment.employee?.department?.id ??
    assignment.section?.department_id ??
    assignment.section?.department?.id ??
    null;
  return did != null && Number(did) === Number(departmentId);
}

function collectScopeAssignments(kpi, scope, user) {
  const assignments = Array.isArray(kpi?.assignments) ? kpi.assignments : [];
  if (!assignments.length) return [];

  if (scope === "employee") {
    const match =
      assignments.find((a) => a.assigned_to_employee === user?.id) ||
      assignments.find((a) => a.employee) ||
      assignments[0];
    return match ? [match] : [];
  }

  if (scope === "section") {
    return assignments.filter((a) => assignmentBelongsToSection(a, user?.sectionId));
  }

  if (scope === "department") {
    return assignments.filter((a) =>
      assignmentBelongsToDepartment(a, user?.departmentId),
    );
  }

  return assignments;
}

function parseEndDate(kpi, assignment) {
  const raw = assignment?.end_date || assignment?.endDate || kpi?.end_date || kpi?.endDate;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(from, to) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function taskPriority(task) {
  if (task.taskType === "approval") return 0;
  if (task.taskType === "assignment") return 1;
  if (task.taskType === "review") return 2;
  return 9;
}

const normalizedTasks = computed(() => {
  const tasks = [
    ...buildAssignmentTasks(myAssignments.value),
    ...buildApprovalTasks(scopedPendingApprovals.value),
    ...buildReviewTasks(myReviews.value),
  ];

  const deduped = [];
  const pickedByKey = new Map();

  tasks.forEach((task) => {
    if (!task?.kpiId) {
      deduped.push(task);
      return;
    }

    const key = `${task.bucket}:${task.kpiId}`;
    const existingIndex = pickedByKey.get(key);
    if (existingIndex == null) {
      pickedByKey.set(key, deduped.length);
      deduped.push(task);
      return;
    }

    const existing = deduped[existingIndex];
    if (taskPriority(task) < taskPriority(existing)) {
      deduped[existingIndex] = task;
    }
  });

  return deduped;
});

const actionableTasks = computed(() =>
  normalizedTasks.value.filter((task) => task.bucket === "action"),
);
const waitingTasks = computed(() =>
  normalizedTasks.value.filter((task) => task.bucket === "waiting"),
);
const completedTasks = computed(() =>
  normalizedTasks.value.filter((task) => task.bucket === "completed"),
);
const activeBucketTasks = computed(() => {
  if (activeBucket.value === "waiting") return waitingTasks.value;
  if (activeBucket.value === "completed") return completedTasks.value;
  return actionableTasks.value;
});
const filteredBucketTasks = computed(() => {
  const normalizedSearch = searchText.value.trim().toLowerCase();

  return activeBucketTasks.value.filter((task) => {
    const matchesType =
      taskTypeFilter.value === "all" || task.taskType === taskTypeFilter.value;
    const matchesSearch =
      !normalizedSearch ||
      task.searchableText?.includes(normalizedSearch) ||
      task.title?.toLowerCase().includes(normalizedSearch) ||
      task.subtitle?.toLowerCase().includes(normalizedSearch);

    return matchesType && matchesSearch;
  });
});
const visibleTasks = computed(() =>
  viewMode.value === "all"
    ? filteredBucketTasks.value
    : filteredBucketTasks.value.slice(0, previewLimit),
);
const viewModeOptions = computed(() => [
  { label: t("workflowInbox.actions.preview"), value: "preview" },
  { label: t("workflowInbox.actions.all"), value: "all" },
]);

const overviewRows = computed(() => {
  const user = currentUser.value;
  const scope = overviewScope.value;
  const list = Array.isArray(overviewKpis.value) ? overviewKpis.value : [];

  const rows = [];
  list.forEach((kpi) => {
    const targets = collectScopeAssignments(kpi, scope, user);
    targets.forEach((assignment) => {
      rows.push(buildPipelineRow(kpi, assignment, t, scope, user?.id));
    });
  });

  const weight = (row) => {
    if (row.overdue) return 0;
    if (row.dueSoon) return 1;
    if (row.workflowBucket === "action") return 2;
    if (row.isRejected) return 3;
    if (row.workflowBucket === "waiting") return 4;
    return 5;
  };

  const cycleScopedRows = rows.filter((row) => dateInsideSelectedCycle(row.endDate));

  // Deduplicate by KPI to avoid double counting when one KPI has chained assignments
  // across department/section/employee in the same workflow.
  const dedupedByKpi = new Map();
  cycleScopedRows.forEach((row) => {
    const existing = dedupedByKpi.get(row.kpiId);
    if (!existing) {
      dedupedByKpi.set(row.kpiId, row);
      return;
    }

    const weightDiff = weight(row) - weight(existing);
    if (weightDiff < 0) {
      dedupedByKpi.set(row.kpiId, row);
      return;
    }
    if (weightDiff === 0) {
      const rowEnd = row.endDate ? row.endDate.getTime() : Infinity;
      const existingEnd = existing.endDate ? existing.endDate.getTime() : Infinity;
      if (rowEnd < existingEnd) {
        dedupedByKpi.set(row.kpiId, row);
      }
    }
  });

  return [...dedupedByKpi.values()].sort((a, b) => {
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    const ae = a.endDate ? a.endDate.getTime() : Infinity;
    const be = b.endDate ? b.endDate.getTime() : Infinity;
    return ae - be;
  });
});

const riskStats = computed(() => {
  const rows = overviewRows.value;
  return {
    overdue: rows.filter((r) => r.overdue).length,
    dueSoon: rows.filter((r) => r.dueSoon && !r.overdue).length,
    attention: rows.filter((r) => r.workflowBucket === "action").length,
    pendingApprovals: scopedPendingApprovals.value.length,
  };
});

function normalizeCycleId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractCycleId(entity) {
  if (!entity || typeof entity !== "object") return null;
  const candidates = [
    entity.cycle,
    entity.cycleId,
    entity.cycle_id,
    entity.reviewCycleId,
    entity.review_cycle_id,
    entity.kpi?.cycle,
    entity.kpi?.cycleId,
    entity.kpi?.cycle_id,
    entity.kpi?.reviewCycleId,
    entity.kpi?.review_cycle_id,
  ];
  for (const c of candidates) {
    const normalized = normalizeCycleId(c);
    if (normalized != null) return normalized;
  }
  return null;
}

const scopedPendingApprovals = computed(() => {
  const selected = normalizeCycleId(selectedCycle.value);
  const groups = Array.isArray(pendingApprovals.value) ? pendingApprovals.value : [];
  if (selected == null) return groups;

  return groups
    .map((group) => {
      const values = Array.isArray(group.kpiValues) ? group.kpiValues : [];
      const filtered = values.filter((value) => {
        const valueCycle = extractCycleId(value);
        return valueCycle == null || valueCycle === selected;
      });
      return {
        ...group,
        kpiValues: filtered,
        totalKpis: filtered.length,
      };
    })
    .filter((group) => (group.kpiValues?.length || 0) > 0);
});

const selectedCycleRange = computed(() => {
  const startRaw = selectedCycleMeta.value?.startDate;
  const endRaw = selectedCycleMeta.value?.endDate;
  if (!startRaw || !endRaw) return null;
  const start = startOfDay(new Date(startRaw));
  const end = startOfDay(new Date(endRaw));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
});

function dateInsideSelectedCycle(dateValue) {
  const range = selectedCycleRange.value;
  if (!range || !dateValue) return true;
  const d = startOfDay(new Date(dateValue));
  if (Number.isNaN(d.getTime())) return true;
  return d >= range.start && d <= range.end;
}

function kpiMatchesSelectedCycle(kpi) {
  const selected = normalizeCycleId(selectedCycle.value);
  if (selected != null) {
    const directCycle = extractCycleId(kpi);
    if (directCycle != null) return directCycle === selected;
    const assignments = Array.isArray(kpi?.assignments) ? kpi.assignments : [];
    const assignmentCycle = assignments
      .map((assignment) => extractCycleId(assignment))
      .find((id) => id != null);
    if (assignmentCycle != null) return assignmentCycle === selected;
  }

  const endDateCandidate = kpi?.end_date || kpi?.endDate || null;
  return dateInsideSelectedCycle(endDateCandidate);
}

function filterKpisBySelectedCycle(list) {
  const source = Array.isArray(list) ? list : [];
  return source.filter((kpi) => kpiMatchesSelectedCycle(kpi));
}

const mergedReviewItems = computed(() => {
  const merged = [];
  const seen = new Set();
  [...(myReviews.value || []), ...(reviewApprovals.value || [])].forEach((review) => {
    if (!review?.id || seen.has(review.id)) return;
    seen.add(review.id);
    merged.push(review);
  });
  return merged;
});

function getReviewPhase(review) {
  return String(review?.evaluationPhase || review?.evaluation_phase || "").toUpperCase();
}

function isReviewStarted(status) {
  const s = String(status || "").toUpperCase();
  return !["", "PENDING", "NOT_STARTED"].includes(s);
}

const endYearStarted = computed(() => {
  if (!selectedCycleMeta.value?.startDate) return true;
  const start = new Date(selectedCycleMeta.value.startDate);
  if (Number.isNaN(start.getTime())) return true;
  const threshold = new Date(Date.UTC(start.getUTCFullYear(), 6, 1)); // Jul 1
  return new Date() >= threshold;
});

const timelineNodes = computed(() => {
  const totalActive = overviewRows.value.length;
  const midYearStartedCount = mergedReviewItems.value.filter(
    (review) =>
      getReviewPhase(review) === "MID_YEAR" && isReviewStarted(review.status),
  ).length;
  const endYearStartedCount = mergedReviewItems.value.filter(
    (review) =>
      getReviewPhase(review) === "YEAR_END" && isReviewStarted(review.status),
  ).length;

  const midYearPending = Math.max(totalActive - midYearStartedCount, 0);
  const endYearPending = Math.max(totalActive - endYearStartedCount, 0);

  return [
    {
      key: "active",
      title: t("workflow.dashboard.timeline.active.title"),
      description: t("workflow.dashboard.timeline.active.description"),
      pending: totalActive,
      tone: "active",
      disabled: false,
    },
    {
      key: "mid-year",
      title: t("workflow.dashboard.timeline.midYear.title"),
      description: t("workflow.dashboard.timeline.midYear.description"),
      pending: midYearPending,
      tone: "mid-year",
      disabled: false,
    },
    {
      key: "end-year",
      title: t("workflow.dashboard.timeline.endYear.title"),
      description: t("workflow.dashboard.timeline.endYear.description"),
      pending: endYearPending,
      tone: "end-year",
      disabled: !endYearStarted.value,
    },
  ];
});

const roleKpiCards = computed(() => {
  if (overviewScope.value === "employee") {
    return [
      {
        key: "employee-action",
        label: t("workflow.dashboard.cards.employeeAction.label"),
        value: actionableTasks.value.length,
        hint: t("workflow.dashboard.cards.employeeAction.hint"),
        tone: "warning",
        handler: () => focusBucket("action"),
      },
      {
        key: "employee-overdue",
        label: t("workflow.dashboard.cards.employeeOverdue.label"),
        value: riskStats.value.overdue,
        hint: t("workflow.dashboard.cards.employeeOverdue.hint"),
        tone: "danger",
        handler: () => togglePipelineFilter("overdue"),
      },
      {
        key: "employee-waiting",
        label: t("workflow.dashboard.cards.employeeWaiting.label"),
        value: waitingTasks.value.length,
        hint: t("workflow.dashboard.cards.employeeWaiting.hint"),
        tone: "approval",
        handler: () => focusBucket("waiting"),
      },
    ];
  }

  return [
    {
      key: "lead-approvals",
      label: t("workflow.dashboard.cards.leadApproval.label"),
      value: riskStats.value.pendingApprovals,
      hint: canOpenApprovals.value
        ? t("workflow.dashboard.cards.leadApproval.hintAllowed")
        : t("workflow.dashboard.cards.leadApproval.hintDenied"),
      tone: "approval",
      handler: canOpenApprovals.value ? () => goToApprovals() : null,
    },
    {
      key: "lead-overdue",
      label: t("workflow.dashboard.cards.leadOverdue.label"),
      value: riskStats.value.overdue,
      hint: t("workflow.dashboard.cards.leadOverdue.hint"),
      tone: "warning",
      handler: () => togglePipelineFilter("overdue"),
    },
    {
      key: "lead-attention",
      label: t("workflow.dashboard.cards.leadAttention.label"),
      value: riskStats.value.attention,
      hint: t("workflow.dashboard.cards.leadAttention.hint"),
      tone: "info",
      handler: () => togglePipelineFilter("attention"),
    },
  ];
});

const priorityActions = computed(() => {
  const actions = [];

  if (riskStats.value.pendingApprovals > 0) {
    actions.push({
      key: "pending-approvals",
      label: t("workflow.dashboard.priority.pendingApprovals.label", {
        count: riskStats.value.pendingApprovals,
      }),
      description: canOpenApprovals.value
        ? t("workflow.dashboard.priority.pendingApprovals.descAllowed")
        : t("workflow.dashboard.priority.pendingApprovals.descDenied"),
      actionText: canOpenApprovals.value
        ? t("workflow.dashboard.priority.pendingApprovals.action")
        : "",
      tone: "priority-approval",
      handler: canOpenApprovals.value ? goToApprovals : null,
    });
  }

  if (riskStats.value.overdue > 0) {
    actions.push({
      key: "overdue-kpis",
      label: t("workflow.dashboard.priority.overdue.label", {
        count: riskStats.value.overdue,
      }),
      description: t("workflow.dashboard.priority.overdue.description"),
      actionText: t("workflow.dashboard.priority.overdue.action"),
      tone: "priority-overdue",
      handler: () => togglePipelineFilter("overdue"),
    });
  }

  if (riskStats.value.dueSoon > 0) {
    actions.push({
      key: "due-soon-kpis",
      label: t("workflow.dashboard.priority.dueSoon.label", {
        count: riskStats.value.dueSoon,
      }),
      description: t("workflow.dashboard.priority.dueSoon.description"),
      actionText: t("workflow.dashboard.priority.dueSoon.action"),
      tone: "priority-due-soon",
      handler: () => togglePipelineFilter("dueSoon"),
    });
  }

  if (actionableTasks.value.length > 0) {
    actions.push({
      key: "my-actions",
      label: t("workflow.dashboard.priority.actionable.label", {
        count: actionableTasks.value.length,
      }),
      description: t("workflow.dashboard.priority.actionable.description"),
      actionText: "",
      tone: "priority-action",
      handler: null,
    });
  }

  return actions.slice(0, 4);
});

const filteredPipelineRows = computed(() => {
  const q = pipelineSearch.value.trim().toLowerCase();
  return overviewRows.value.filter((row) => {
    if (pipelineFilter.value === "overdue" && !row.overdue) return false;
    if (pipelineFilter.value === "dueSoon" && !(row.dueSoon && !row.overdue)) {
      return false;
    }
    if (pipelineFilter.value === "attention" && row.workflowBucket !== "action") {
      return false;
    }
    if (!q) return true;
    return row.searchText.includes(q);
  });
});

const visiblePipelineRows = computed(() => {
  if (pipelineShowAll.value) return filteredPipelineRows.value;
  return filteredPipelineRows.value.slice(0, pipelinePreviewLimit);
});

const pipelineColumns = computed(() => [
  {
    key: "item",
    title: t("workflowInbox.overview.columns.item"),
    width: 200,
  },
  {
    key: "owner",
    title: t("workflow.dashboard.columns.ownerScope"),
    width: 160,
  },
  {
    key: "stage",
    title: t("workflow.dashboard.columns.workflowStep"),
    width: 140,
  },
  {
    key: "yourTurn",
    title: t("workflow.dashboard.columns.nextActor"),
    width: 200,
  },
  {
    key: "due",
    title: t("workflowInbox.overview.columns.due"),
    width: 120,
  },
  {
    key: "heat",
    title: t("workflowInbox.overview.columns.heat"),
    width: 110,
  },
  {
    key: "open",
    title: t("workflowInbox.overview.columns.open"),
    width: 88,
    fixed: "right",
  },
]);

function togglePipelineFilter(value) {
  pipelineFilter.value = pipelineFilter.value === value ? "all" : value;
}

function getFullName(employee) {
  if (!employee) return t("workflow.labels.unknownOwner");
  return (
    [employee.last_name, employee.first_name].filter(Boolean).join(" ").trim() ||
    employee.username ||
    t("workflow.labels.unknownOwner")
  );
}

function getRelevantAssignment(kpi) {
  const assignments = Array.isArray(kpi?.assignments) ? kpi.assignments : [];
  return (
    assignments.find(
      (assignment) => assignment.assigned_to_employee === currentUser.value?.id,
    ) || assignments.find((assignment) => assignment.employee) || assignments[0]
  );
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

function formatNumber(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "-";
  return numericValue.toLocaleString();
}

function getOwnerLabel(assignment) {
  if (assignment?.employee) {
    return getFullName(assignment.employee);
  }
  if (assignment?.assigned_to_section) {
    return assignment.section?.name || t("workflow.detail.scope.section");
  }
  if (assignment?.assigned_to_department) {
    return (
      assignment.department?.name ||
      assignment.section?.department?.name ||
      t("workflow.detail.scope.department")
    );
  }
  return t("workflow.labels.unknownOwner");
}

function isOwnEmployeeAssignment(assignment, userId) {
  if (!userId || !assignment?.assigned_to_employee) return false;
  return Number(assignment.assigned_to_employee) === Number(userId);
}

function getWorkflowStageLabel(status, translate) {
  const s = String(status || "");
  if (s === "APPROVED") return translate("workflowInbox.control.stage.approved");
  if (/^REJECTED_/i.test(s)) return translate("workflowInbox.control.stage.rejected");
  if (s === "DRAFT") return translate("workflowInbox.control.stage.draft");
  if (s === "NOT_SUBMIT") return translate("workflowInbox.control.stage.notSubmitted");
  if (
    s === "SUBMITTED" ||
    s === "PENDING_SECTION_APPROVAL" ||
    s === "PENDING_DEPT_APPROVAL" ||
    s === "PENDING_MANAGER_APPROVAL"
  ) {
    return translate("workflowInbox.control.stage.pendingApproval");
  }
  return translate("workflowInbox.control.stage.inProgress");
}

function stageTagColor(status) {
  const s = String(status || "");
  if (s === "APPROVED") return "green";
  if (/^REJECTED_/i.test(s)) return "red";
  if (s === "DRAFT" || s === "NOT_SUBMIT") return "default";
  if (
    s === "SUBMITTED" ||
    s === "PENDING_SECTION_APPROVAL" ||
    s === "PENDING_DEPT_APPROVAL" ||
    s === "PENDING_MANAGER_APPROVAL"
  ) {
    return "blue";
  }
  return "processing";
}

function getYourTurnLabel(status, assignment, mapping, scope, userId, translate) {
  const normalizedStatus = String(status || "");
  if (normalizedStatus === "NOT_SUBMIT" || normalizedStatus === "DRAFT") {
    if (scope === "employee" && isOwnEmployeeAssignment(assignment, userId)) {
      return t("workflow.dashboard.nextActor.notSubmitSelf");
    }
    return t("workflow.dashboard.nextActor.notSubmitAssignee");
  }
  if (normalizedStatus === "PENDING_SECTION_APPROVAL") {
    return t("workflow.dashboard.nextActor.pendingSection");
  }
  if (normalizedStatus === "PENDING_DEPT_APPROVAL") {
    return t("workflow.dashboard.nextActor.pendingDepartment");
  }
  if (normalizedStatus === "PENDING_MANAGER_APPROVAL") {
    return t("workflow.dashboard.nextActor.pendingManager");
  }
  if (/^REJECTED_/i.test(normalizedStatus)) {
    return t("workflow.dashboard.nextActor.rejected");
  }
  if (normalizedStatus === "APPROVED") {
    return t("workflow.dashboard.nextActor.approved");
  }
  if (normalizedStatus === "SUBMITTED") {
    return t("workflow.dashboard.nextActor.submitted");
  }
  if (mapping.bucket === "completed") {
    return translate("workflowInbox.control.yourTurn.done");
  }
  if (mapping.bucket === "waiting") {
    if (scope === "employee" && isOwnEmployeeAssignment(assignment, userId)) {
      return translate("workflowInbox.control.yourTurn.waitingOnApprovers");
    }
    return translate("workflowInbox.control.yourTurn.waitingInChain");
  }
  if (scope === "employee" && isOwnEmployeeAssignment(assignment, userId)) {
    return translate("workflowInbox.control.yourTurn.needsYourUpdate");
  }
  return translate("workflowInbox.control.yourTurn.needsAssigneeOrTeam");
}

function buildPipelineRow(kpi, assignment, translate, scope, userId) {
  const latestValue = getLatestValue(assignment);
  const status = latestValue?.status || "NOT_SUBMIT";
  const mapping = getAssignmentWorkflowSummary(status, translate);

  const endDate = parseEndDate(kpi, assignment);
  const today = startOfDay(new Date());
  const valueComplete = status === "APPROVED";
  const overdue =
    !!endDate &&
    startOfDay(endDate) < today &&
    !valueComplete;
  const dueSoon =
    !!endDate &&
    !overdue &&
    startOfDay(endDate) >= today &&
    daysBetween(today, endDate) <= 7;

  const isRejected = /^REJECTED_/i.test(String(status));

  let dueRelativeLabel = "";
  if (!endDate) {
    dueRelativeLabel = "";
  } else if (overdue) {
    dueRelativeLabel = translate("workflowInbox.overview.daysOverdue", {
      n: Math.abs(daysBetween(endDate, today)),
    });
  } else {
    const left = daysBetween(today, endDate);
    dueRelativeLabel =
      left === 0
        ? translate("workflowInbox.overview.daysLeft", { n: 0 })
        : translate("workflowInbox.overview.daysLeft", { n: left });
  }

  const dueDateLabel = endDate
    ? endDate.toLocaleDateString()
    : translate("workflowInbox.overview.dueNone");

  const perspectiveName = kpi.perspective?.name || "";
  const workflowStageLabel = getWorkflowStageLabel(status, translate);
  const stageColor = stageTagColor(status);
  const yourTurnLabel = getYourTurnLabel(
    status,
    assignment,
    mapping,
    scope,
    userId,
    translate,
  );

  const row = {
    kpiId: kpi.id,
    key: `kpi-${kpi.id}-asg-${assignment.id}`,
    kpiName: kpi.name,
    ownerLabel: getOwnerLabel(assignment),
    workflowStageLabel,
    stageColor,
    yourTurnLabel,
    dueDateLabel,
    dueRelativeLabel,
    endDate,
    overdue,
    dueSoon,
    workflowBucket: mapping.bucket,
    isRejected,
    actionLabel: overdue ? t("workflow.dashboard.actions.overdue") : mapping.actionLabel,
    route: { name: "KpiDetail", params: { id: kpi.id } },
    searchText: [
      kpi.name,
      perspectiveName,
      getOwnerLabel(assignment),
      workflowStageLabel,
      yourTurnLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };

  return row;
}

function buildAssignmentTasks(kpis) {
  return (kpis || [])
    .map((kpi) => {
      const assignment = getRelevantAssignment(kpi);
      if (!assignment) return null;

      const latestValue = getLatestValue(assignment);
      const status = latestValue?.status || "NOT_SUBMIT";
      const mapping = getAssignmentWorkflowSummary(status, t);

      return {
        key: `assignment-${assignment.id}`,
        kpiId: kpi.id,
        taskType: "assignment",
        bucket: mapping.bucket,
        tagColor: mapping.tagColor,
        tagLabel: t("workflow.labels.personalKpi"),
        currentStep: mapping.currentStep,
        nextAction: mapping.nextAction,
        title: kpi.name,
        subtitle: t("workflow.assignment.summary", {
          owner: getFullName(assignment.employee),
          target: formatNumber(assignment.targetValue ?? kpi.target),
          unit: kpi.unit || "",
        }).trim(),
        actionLabel: t("workflow.actions.viewStatus"),
        searchableText: [
          kpi.name,
          getFullName(assignment.employee),
          assignment.employee?.username,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        route: {
          path: "/my-kpi-self-review",
          query: { cycle: String(selectedCycle.value || "") },
        },
      };
    })
    .filter(Boolean);
}

function buildApprovalTasks(groups) {
  return (groups || []).map((group) => {
    const steps = new Set(
      (group.kpiValues || []).map((value) =>
        getPendingApprovalStep(value.status, t),
      ),
    );

    return {
      key: `approval-${group.employee?.id}`,
      taskType: "approval",
      bucket: "action",
      tagColor: "orange",
      tagLabel: t("workflow.labels.pendingApproval"),
      currentStep:
        steps.size === 1
          ? [...steps][0]
          : t("workflow.approval.multipleSteps", {
              count: group.totalKpis || group.kpiValues?.length || 0,
            }),
      nextAction: t("workflow.approval.openForEmployee", {
        name: getFullName(group.employee),
      }),
      title: getFullName(group.employee),
      subtitle: t("workflow.approval.employeeSummary", {
        section: group.employee?.section?.name || t("workflow.labels.noSection"),
        count: group.totalKpis || group.kpiValues?.length || 0,
      }),
      actionLabel: t("workflow.actions.openApproval"),
      searchableText: [
        getFullName(group.employee),
        group.employee?.username,
        group.employee?.section?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      route: {
        path: "/approvals",
        query: { employeeId: String(group.employee?.id || "") },
      },
    };
  });
}

function buildReviewTasks(reviews) {
  return (reviews || []).map((review) => {
    const mapping = getReviewWorkflowSummary(review.status, t);
    return {
      key: `review-${review.id}`,
      kpiId: review.kpi?.id || null,
      taskType: "review",
      bucket: mapping.bucket,
      tagColor: mapping.tagColor,
      tagLabel: t("workflow.labels.review"),
      currentStep: mapping.currentStep,
      nextAction: mapping.nextAction,
      title: review.kpi?.name || `KPI review #${review.id}`,
      subtitle: t("workflow.review.summary", {
        cycle: selectedCycleLabel.value,
        actual:
          review.actualValue != null ? formatNumber(review.actualValue) : "-",
      }),
      actionLabel: mapping.actionLabel,
      searchableText: [
        review.kpi?.name,
        getFullName(review.employee),
        review.employee?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      route: {
        path: "/my-kpi-self-review",
        query: {
          cycle: String(selectedCycle.value || ""),
          reviewId: String(review.id),
          action:
            review.status === "EMPLOYEE_FEEDBACK"
              ? "feedback"
              : review.status === "COMPLETED"
                ? "detail"
                : "focus",
        },
      },
    };
  });
}

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

function canLoadReviewApprovals() {
  return hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, [
    "section",
    "department",
    "manager",
  ]);
}

async function fetchScopedOverviewKpis(cycle) {
  const user = currentUser.value;
  const scope = overviewScope.value;
  const params = { limit: 1000 };
  if (cycle) params.cycle = cycle;

  if (scope === "section") {
    if (!user?.sectionId) return [];
    const response = await apiClient.get(`/kpis/sections/${user.sectionId}`, {
      params,
    });
    return response.data?.data || response.data || [];
  }

  if (scope === "department") {
    if (!user?.departmentId) return [];
    const response = await apiClient.get(`/kpis/departments/${user.departmentId}`, {
      params,
    });
    return response.data?.data || response.data || [];
  }

  if (scope === "company") {
    const response = await apiClient.get("/kpis", { params });
    const list = response.data?.data || response.data || [];
    if (!user?.id) return list;
    const createdByMe = list.filter(
      (kpi) => kpi && Number(kpi.created_by) === Number(user.id),
    );
    return createdByMe.length ? createdByMe : list;
  }

  return [];
}

async function refreshAll() {
  if (!store.getters["auth/isAuthenticated"]) {
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = "";

  try {
    const cycles = await getReviewCycles();
    if (!store.getters["auth/isAuthenticated"]) {
      return;
    }
    const fromStore = pickReviewCycleIdFromStore(store, cycles);
    selectedCycle.value = fromStore ?? pickDefaultCycle(cycles);
    selectedCycleMeta.value =
      cycles.find((cycle) => String(cycle.id) === String(selectedCycle.value)) || null;

    const cycleParam = selectedCycle.value || undefined;
    const scope = overviewScope.value;
    const extraOverviewPromise =
      scope === "employee"
        ? Promise.resolve(null)
        : fetchScopedOverviewKpis(selectedCycle.value);

    const [assignmentsResponse, approvalsResponse, reviewsResponse, scopedKpis] =
      await Promise.all([
        apiClient.get("/kpis/my-assignments", {
          params: { limit: 1000, cycle: cycleParam },
        }),
        apiClient.get("/kpi-values/pending-approvals", {
          params: {
            groupBy: "employee",
            includeReview: "true",
            cycle: cycleParam,
          },
        }),
        selectedCycle.value
          ? apiClient.get("/kpi-review/my", {
              params: { cycle: selectedCycle.value },
            })
          : Promise.resolve({ data: [] }),
        extraOverviewPromise,
      ]);

    if (!store.getters["auth/isAuthenticated"]) {
      return;
    }
    const reviewApprovalResponse =
      selectedCycle.value && canLoadReviewApprovals()
        ? await getKpiReviewList({ cycle: selectedCycle.value })
        : [];

    const assignmentListRaw =
      assignmentsResponse.data?.data || assignmentsResponse.data || [];
    const assignmentList = filterKpisBySelectedCycle(assignmentListRaw);
    myAssignments.value = assignmentList;
    pendingApprovals.value = approvalsResponse.data || [];
    myReviews.value = reviewsResponse.data || [];
    reviewApprovals.value = Array.isArray(reviewApprovalResponse)
      ? reviewApprovalResponse
      : [];

    overviewKpis.value = filterKpisBySelectedCycle(
      scope === "employee" ? assignmentList : scopedKpis || [],
    );
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      t("workflow.errors.loadTasks");
  } finally {
    loading.value = false;
  }
}

function openTask(task) {
  if (!task?.route) return;
  router.push(task.route);
}

function openRoute(route) {
  if (!route) return;
  router.push(route);
}

function goToApprovals() {
  if (!canOpenApprovals.value) return;
  router.push("/approvals");
}

function focusBucket(bucket) {
  activeBucket.value = bucket;
  viewMode.value = "preview";
}

watch(
  () => store.getters["reviewCycle/selectedCycleId"],
  () => {
    refreshAll();
  },
);

watch(pipelineFilter, () => {
  pipelineShowAll.value = false;
});

onMounted(() => {
  refreshAll();
});
</script>

<style scoped>
.my-tasks-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-card,
.task-card {
  border-radius: 20px;
  box-shadow: 0 14px 40px rgba(16, 24, 40, 0.08);
}

.hero-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}

.hero-kicker {
  color: #1565c0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.hero-header h1 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  line-height: 1.2;
  color: #0f172a;
}

.hero-header p {
  margin: 0;
  max-width: 820px;
  color: #475569;
  font-size: 14px;
}

.risk-row {
  margin-top: 16px;
}

.clickable-risk {
  cursor: pointer;
}

.clickable-risk:hover {
  border-color: #7c3aed !important;
  box-shadow: 0 6px 16px rgba(109, 40, 217, 0.12);
}

.risk-tile {
  border-radius: 14px;
  padding: 12px 14px;
  min-height: 108px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.risk-tile.approvals {
  cursor: default;
}

.risk-tile:not(.approvals):hover {
  border-color: #94a3b8;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
}

.risk-tile.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px #2563eb inset;
}

.risk-tile.overdue .risk-value {
  color: #b91c1c;
}

.risk-tile.due-soon .risk-value {
  color: #c2410c;
}

.risk-tile.attention .risk-value {
  color: #a16207;
}

.risk-tile.approvals .risk-value {
  color: #6d28d9;
}

.risk-value {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.1;
  color: #0f172a;
}

.risk-label {
  margin-top: 6px;
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
}

.risk-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.35;
}

.control-row {
  margin-top: 12px;
}

.timeline-block {
  margin-top: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px;
  background: #fff;
}

.timeline-track {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  position: relative;
}

.timeline-track::before {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  top: 14px;
  height: 2px;
  background: #cbd5e1;
  z-index: 0;
}

.timeline-node {
  padding: 6px 4px 2px;
  position: relative;
}

.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
  background: #fff;
  width: fit-content;
  padding-right: 6px;
}

.timeline-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid #2563eb;
  background: #fff;
  flex: 0 0 auto;
}

.timeline-node.active .timeline-dot {
  border-color: #2563eb;
  background: #2563eb;
}

.timeline-node.mid-year .timeline-dot {
  border-color: #ea580c;
  background: #ea580c;
}

.timeline-node.end-year .timeline-dot {
  border-color: #7c3aed;
  background: #7c3aed;
}

.timeline-node.disabled {
  opacity: 0.8;
}

.timeline-node.disabled .timeline-dot {
  border-color: #94a3b8;
  background: #94a3b8;
}

.timeline-node.disabled .timeline-head::after {
  background: #e2e8f0;
}

.timeline-node-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.timeline-node-desc {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
  padding-left: 26px;
}

.timeline-status-row {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.timeline-status-item {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  padding-left: 30px;
}

.timeline-status-item.disabled {
  color: #94a3b8;
}

.control-block {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px;
  background: #fff;
}

.control-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.control-subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.priority-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.priority-item {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
}

.priority-item.priority-overdue {
  border-color: #fecaca;
  background: #fef2f2;
}

.priority-item.priority-due-soon {
  border-color: #fed7aa;
  background: #fff7ed;
}

.priority-item.priority-approval,
.priority-item.priority-review {
  border-color: #ddd6fe;
  background: #f5f3ff;
}

.priority-item.priority-action {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.priority-content {
  min-width: 0;
}

.priority-label {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.priority-desc {
  margin-top: 3px;
  color: #475569;
  font-size: 12px;
}

.role-kpi-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-kpi-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
}

.role-kpi-card[role="button"] {
  cursor: pointer;
}

.role-kpi-card.warning {
  border-color: #fed7aa;
  background: #fff7ed;
}

.role-kpi-card.danger {
  border-color: #fecaca;
  background: #fef2f2;
}

.role-kpi-card.info {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.role-kpi-card.approval {
  border-color: #ddd6fe;
  background: #f5f3ff;
}

.role-kpi-value {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  color: #0f172a;
}

.role-kpi-label {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.role-kpi-hint {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

.pipeline-card,
.inbox-card {
  overflow: hidden;
}

.card-head,
.inbox-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.card-title {
  margin: 0 0 4px;
  font-size: 1.1rem;
  color: #0f172a;
}

.card-lead {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  max-width: 720px;
}

.pipeline-search {
  max-width: 360px;
  margin-bottom: 14px;
}

.pipeline-table :deep(.ant-table-cell) {
  vertical-align: top;
}

.cell-kpi-name {
  font-weight: 700;
  color: #0f172a;
}

.cell-your-turn {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
  line-height: 1.35;
}

.cell-due-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.cell-open-disabled {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
}

.pipeline-footer {
  display: flex;
  justify-content: center;
  padding-top: 14px;
}

.inbox-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
}

.task-main {
  min-width: 0;
}

.task-topline {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.task-step {
  color: #0f172a;
  font-weight: 600;
}

.task-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.task-subtitle,
.task-next {
  color: #475569;
  font-size: 14px;
}

.task-next {
  margin-top: 6px;
}

.inbox-footer {
  display: flex;
  justify-content: center;
  padding-top: 18px;
}

@media (max-width: 768px) {
  .hero-header,
  .task-item {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-header h1 {
    font-size: 1.35rem;
  }

  .timeline-track {
    grid-template-columns: 1fr;
  }

  .timeline-status-row {
    grid-template-columns: 1fr;
  }

  .timeline-head::after {
    display: none;
  }

  .timeline-track::before {
    display: none;
  }
}
</style>
