<template>
  <div class="kpi-review-list">
    <a-card class="modern-card" v-if="canViewKpiReview">
      <template #title>
        <div class="page-header">
          <icon-trophy-outlined class="page-icon" />
          <span class="page-title">{{ $t("kpiReviewListTitle") }}</span>
        </div>
      </template>

      <div class="filters modern-filters">
        <a-input-group compact style="display: flex; gap: 12px; width: 100%">
          <a-select
            v-model:value="selectedCycle"
            :options="cycleOptions"
            :placeholder="$t('selectCycle')"
            class="modern-filter-input"
            style="flex: 1; min-width: 160px"
            @update:value="(v) => pushReviewCycleToGlobalStore(store, v)"
          >
            <template #suffixIcon>
              <icon-calendar-outlined />
            </template>
          </a-select>
          <a-select
            v-model:value="selectedStatus"
            :options="statusOptions"
            :placeholder="$t('reviewStatus')"
            class="modern-filter-input"
            style="flex: 1; min-width: 160px"
          >
            <template #suffixIcon>
              <icon-filter-outlined />
            </template>
          </a-select>
          <a-input
            v-model:value="searchText"
            :placeholder="$t('searchKpiEmployee')"
            class="modern-filter-input"
            style="flex: 2; min-width: 180px"
          >
            <template #prefix>
              <icon-search-outlined />
            </template>
          </a-input>
        </a-input-group>
      </div>

      <LoadingOverlay :visible="loading" />

      <div class="table-container">
        <div v-if="canReview && groupedReviews.length > 0" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 0 8px;">
          <span style="color: #666; font-size: 14px;">
             Only reviews with valid scores will be approved.
          </span>
          <a-button
            type="primary"
            :loading="batchApproveLoading"
            @click="handleBatchApprove"
            :disabled="selectedEmployeeIds.length === 0"
          >
            <icon-check-outlined />
            Approve Selected ({{ selectedEmployeeIds.length }})
          </a-button>
        </div>

        <a-table
          :columns="employeeColumns"
          :data-source="groupedReviews"
          row-key="employeeId"
          :row-selection="rowSelection"
          :loading="loading"
          bordered
          class="modern-table"
          :pagination="{ pageSize: 10, showSizeChanger: true }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employeeName'">
              <div style="font-weight: 500; color: #1a237e; display: flex; align-items: center;">
                <icon-user-outlined style="margin-right: 8px; color: #b37feb; font-size: 16px;" />
                <span>
                  {{ $getFullName(record.employee) }}
                  <span style="color: #8c8c8c; font-weight: normal; margin-left: 4px;">({{ record.employee?.username }})</span>
                </span>
              </div>
            </template>

            <template v-else-if="column.key === 'department'">
               {{ record.employee?.department?.name || '-' }}
            </template>

            <template v-else-if="column.key === 'section'">
               {{ record.employee?.section?.name || '-' }}
            </template>

            <template v-else-if="column.key === 'totalKpis'">
              <div style="border: 1px solid #d9d9d9; border-radius: 4px; padding: 2px 8px; display: inline-block; color: #1890ff; font-weight: 600; background-color: #f0f5ff;">
                {{ record.totalKpis }}
              </div>
            </template>

            <template v-else-if="column.key === 'workflow'">
              <div class="workflow-cell">
                <a-tag color="processing">
                  {{ getEmployeeReviewWorkflow(record).currentStep }}
                </a-tag>
                <div class="workflow-next">
                  {{ getEmployeeReviewWorkflow(record).nextAction }}
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'actions'">
              <a-button
                type="primary"
                size="small"
                @click="openEmployeeKpisModal(record)"
                class="action-btn"
              >
                <icon-eye-outlined />
                View & Edit KPIs
              </a-button>
            </template>
          </template>
        </a-table>
      </div>

      <ReviewFormModal
        v-if="showReviewForm"
        :review="selectedReview"
        :visible="showReviewForm"
        @close="closeReviewForm"
        @saved="onReviewSaved"
        @show-history="onShowHistoryFromModal"
        modal-class="modern-modal"
      />
      <ReviewHistoryModal
        v-if="showHistory"
        :review="selectedReview"
        :visible="showHistory"
        @close="closeHistory"
        class="modern-modal"
      />

       <!-- Employee KPIs Modal -->
      <a-modal
        :open="showEmployeeKpisModal"
        :title="`${$t('kpisOfEmployee')} - ${$getFullName(selectedEmployeeReviews?.employee)}`"
        @cancel="closeEmployeeKpisModal"
        :footer="null"
        width="1100px"
        class="modern-modal"
        destroy-on-close
      >
        <a-table
          :columns="kpiColumns"
          :data-source="selectedEmployeeReviews?.reviews || []"
          row-key="id"
          bordered
          class="modern-table"
          :pagination="{ pageSize: 5 }"
        >
           <template #bodyCell="slotProps">
             <template v-if="slotProps.column.key === 'kpiName'">
                <span :style="slotProps.record.kpi?.deleted_at ? { color: '#ff4d4f', textDecoration: 'line-through' } : {}">
                  {{ slotProps.record.kpi?.name }}
                </span>
                <span v-if="slotProps.record.kpi?.deleted_at" style="color: #ff4d4f; font-size: 12px; margin-left: 4px">
                  ({{ $t("deleted") }})
                </span>
             </template>

             <template v-else-if="slotProps.column.key === 'targetValue'">
               {{ Number(slotProps.record.targetValue).toLocaleString() }} {{ slotProps.record.kpi?.unit }}
             </template>

             <template v-else-if="slotProps.column.key === 'actualValue'">
               {{ Number(slotProps.record.actualValue).toLocaleString() }} {{ slotProps.record.kpi?.unit }}
             </template>

             <template v-else-if="slotProps.column.key === 'status'">
              <span
                v-if="slotProps.record.status"
                :class="['status-tag', slotProps.record.status.toLowerCase()]"
              >
                <component
                  :is="statusIcon(slotProps.record.status)"
                  style="
                    margin-right: 6px;
                    font-size: 1.1em;
                    vertical-align: middle;
                  "
                />
                {{ $t("statusReview." + slotProps.record.status.toLowerCase()) }}
              </span>
             </template>

             <template v-else-if="slotProps.column.key === 'workflow'">
              <div class="workflow-cell">
                <a-tag :color="getReviewWorkflowSummary(slotProps.record.status, t).tagColor">
                  {{ getReviewWorkflowSummary(slotProps.record.status, t).currentStep }}
                </a-tag>
                <div class="workflow-next">
                  {{ getReviewWorkflowSummary(slotProps.record.status, t).nextAction }}
                </div>
              </div>
             </template>

             <template v-else-if="slotProps.column.key === 'score'">
               {{ slotProps.record.score != null ? Number(slotProps.record.score).toLocaleString() : '-' }}
             </template>

            <template v-else-if="slotProps.column.key === 'actions'">
              <div style="display: flex; align-items: center; gap: 8px">
                <a-tooltip :title="$t('review')" v-if="canReview">
                  <a-button
                    type="primary"
                    size="small"
                    @click="openReviewForm(slotProps.record)"
                    class="action-btn icon-btn"
                    :disabled="!!slotProps.record.kpi?.deleted_at"
                  >
                    <icon-edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="$t('reviewHistory')">
                  <a-button
                    type="default"
                    size="small"
                    @click="viewHistory(slotProps.record)"
                    class="action-btn icon-btn"
                  >
                    <icon-history-outlined />
                  </a-button>
                </a-tooltip>
              </div>
            </template>
           </template>
        </a-table>
      </a-modal>
    </a-card>
    <a-result
      v-else
      status="403"
      title="403"
      sub-title="Sorry, you are not authorized to access this page."
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue";
import dayjs from "dayjs";
import {
  getKpiReviewList,
  getReviewCycles,
  batchApproveReviews,
} from "@/core/services/kpiReviewApi";
import ReviewFormModal from "./ReviewFormModal.vue";
import ReviewHistoryModal from "./ReviewHistoryModal.vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { getFullName } from "@/core/utils/format";
import { getReviewWorkflowSummary } from "@/core/utils/workflowTasks";
import {
  pickReviewCycleIdFromStore,
  pushReviewCycleToGlobalStore,
  syncLocalReviewCycleFromStore,
} from "@/core/composables/useReviewCycleGlobalSync";

import {
  TrophyOutlined as IconTrophyOutlined,
  CalendarOutlined as IconCalendarOutlined,
  FilterOutlined as IconFilterOutlined,
  SearchOutlined as IconSearchOutlined,
  EditOutlined as IconEditOutlined,
  HistoryOutlined as IconHistoryOutlined,
  CheckCircleTwoTone as IconCheckCircleTwoTone,
  ClockCircleTwoTone as IconClockCircleTwoTone,
  SyncOutlined as IconSyncOutlined,
  SmileTwoTone as IconSmileTwoTone,
  UserSwitchOutlined as IconUserSwitchOutlined,
  UserOutlined as IconUserOutlined,
  ExclamationCircleTwoTone as IconExclamationCircleTwoTone,
  CloseCircleTwoTone as IconCloseCircleTwoTone,
  EyeOutlined as IconEyeOutlined,
  CheckOutlined as IconCheckOutlined,
} from "@ant-design/icons-vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const reviews = ref([]);
const store = useStore();
const loading = computed(() => store.getters["loading/isLoading"]);
const selectedCycle = ref(null);
const selectedStatus = ref(null);
const searchText = ref("");
const showReviewForm = ref(false);
const showHistory = ref(false);
const selectedReview = ref(null);
const showEmployeeKpisModal = ref(false);
const selectedEmployeeReviews = ref(null);
const cycleOptions = ref([]);
const reviewCyclesList = ref([]);
const statusOptions = computed(() => [
  { label: t("all"), value: "" },
  { label: t("pendingReview"), value: "PENDING" },
  { label: t("managerReviewed"), value: "MANAGER_REVIEWED" },
  { label: t("awaitingEmployeeFeedback"), value: "EMPLOYEE_FEEDBACK" },
  { label: t("pendingManagerApproval"), value: "PENDING_MANAGER_APPROVAL" },
  { label: t("completed"), value: "COMPLETED" },
]);
const manualSearch = ref(false);
const lastModal = ref(null);
const queryHandled = ref(false);

// Employee table columns
const employeeColumns = computed(() => [
  { title: t("employeeName"), key: "employeeName", width: 250 },
  { title: t("department"), key: "department", width: 150 },
  { title: t("section"), key: "section", width: 150 },
  { title: t("totalKpis"), key: "totalKpis", align: "center", width: 120 },
  { title: t("workflowStatus"), key: "workflow", width: 280 },
  { title: t("actions"), key: "actions", align: "center", width: 180 },
]);

// KPI modal columns
const kpiColumns = computed(() => [
  { title: t("kpiName"), key: "kpiName" },
  { title: t("target"), key: "targetValue" },
  { title: t("actualResult"), key: "actualValue" },
  { title: t("status"), key: "status" },
  { title: t("workflowStatus"), key: "workflow", width: 260 },
  { title: t("score"), key: "score" },
  { title: t("actions"), key: "actions" },
]);

const getEmployeeReviewWorkflow = (group) => {
  const reviews = Array.isArray(group?.reviews) ? group.reviews : [];
  const pendingReview = reviews.find((review) => review.status !== "COMPLETED");
  const baseReview = pendingReview || reviews[0];

  if (!baseReview) {
    return {
      currentStep: t("workflow.generic.processing"),
      nextAction: t("workflow.generic.openForDetails"),
    };
  }

  if (reviews.length > 1 && reviews.some((review) => review.status !== baseReview.status)) {
    return {
      currentStep: t("workflow.approval.multipleSteps", {
        count: group.totalKpis || reviews.length,
      }),
      nextAction: t("workflow.approval.openAndProcess", {
        count: group.totalKpis || reviews.length,
      }),
    };
  }

  return getReviewWorkflowSummary(baseReview.status, t);
};

const filteredReviews = computed(() => {
  let data = reviews.value;
  if (selectedCycle.value)
    data = data.filter((r) => r.cycle === String(selectedCycle.value));
  if (selectedStatus.value)
    data = data.filter((r) => r.status === selectedStatus.value);
  if (searchText.value) {
    const s = searchText.value.toLowerCase();
    data = data.filter(
      (r) =>
        r.kpi?.name?.toLowerCase().includes(s) ||
        getFullName(r.employee)
          .toLowerCase()
          .includes(s),
    );
  }
  return data;
});

// Group reviews by employee
const groupedReviews = computed(() => {
  const grouped = {};

  filteredReviews.value.forEach((review) => {
    const employeeId = review.employee?.id;
    if (!employeeId) return;

    if (!grouped[employeeId]) {
      grouped[employeeId] = {
        employee: review.employee,
        reviews: [],
      };
    }

    grouped[employeeId].reviews.push(review);
  });

  return Object.values(grouped).map((group) => ({
    employee: group.employee,
    totalKpis: group.reviews.length,
    reviews: group.reviews,
    employeeId: group.employee.id, // Direct ID for rowKey
  }));
});

const selectedEmployeeIds = ref([]);
const batchApproveLoading = ref(false);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || [],
);
function hasPermission(action, resource, scopes) {
  if (!Array.isArray(scopes)) scopes = [scopes];
  return userPermissions.value?.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scopes[0] ? scopes.includes(p.scope) : true),
  );
}

const canViewKpiReview = computed(() => {
  return (
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, "section") ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, "department") ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, "manager")
  );
});

const canReview = computed(() => {
  return (
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW, "section") ||
    hasPermission(
      RBAC_ACTIONS.APPROVE,
      RBAC_RESOURCES.KPI_REVIEW,
      "department",
    ) ||
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW, "manager")
  );
});

const rowSelection = computed(() => {
  if (!canReview.value) return null;
  return {
    selectedRowKeys: selectedEmployeeIds.value,
    onChange: (selectedRowKeys) => {
      selectedEmployeeIds.value = selectedRowKeys;
    },
  };
});

const getApprovalLevel = () => {
   if (hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW, "manager")) return 'manager';
   if (hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW, "department")) return 'department';
   if (hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW, "section")) return 'section';
   return null;
};

const handleBatchApprove = async () => {
    const level = getApprovalLevel();
    if (!level) return;

    batchApproveLoading.value = true;
    try {
        const res = await batchApproveReviews(selectedEmployeeIds.value, level);

        // Show result notification
        if (res.failed > 0) {
             const errorList = res.errors.slice(0, 5).join('\n');
             const more = res.errors.length > 5 ? `\n...and ${res.errors.length - 5} more` : '';
             alert(`Success: ${res.success}, Failed: ${res.failed}\nErrors:\n${errorList}${more}`);
        } else {
             alert(`Successfully approved ${res.success} employees!`);
        }

        selectedEmployeeIds.value = [];
        fetchReviews();
    } catch (e) {
        alert('Batch approval failed: ' + (e.message || 'Unknown error'));
    } finally {
        batchApproveLoading.value = false;
    }
};

const fetchReviews = async () => {
  store.dispatch("loading/startLoading");
  try {
    const params = {
      cycle: selectedCycle.value,
      status: selectedStatus.value,
    };

    if (searchText.value && manualSearch.value) {
      params.search = searchText.value;
    }
    const res = await getKpiReviewList(params);
    reviews.value = res;
    await nextTick();
    tryHandleRouteQuery();
  } finally {
    store.dispatch("loading/stopLoading");
  }
};

const fetchCycles = async () => {
  try {
    const res = await getReviewCycles();
    if (!res || !Array.isArray(res)) {
      return;
    }

    cycleOptions.value = res.map((c) => ({ label: c.name, value: c.id }));
    reviewCyclesList.value = res;

    const queryCycle = Number(route.query.cycle);
    if (queryCycle && res.some((cycle) => cycle.id === queryCycle)) {
      selectedCycle.value = queryCycle;
      await nextTick();
      fetchReviews();
      return;
    }

    const fromStore = pickReviewCycleIdFromStore(store, res);
    if (fromStore != null) {
      selectedCycle.value = fromStore;
      await nextTick();
      fetchReviews();
      return;
    }

    if (res.length > 0 && !selectedCycle.value) {
      const today = dayjs().startOf("day");
      const currentCycle = res.find((cycle) => {
        if (!cycle.startDate || !cycle.endDate) return false;
        const startDate = dayjs(cycle.startDate).startOf("day");
        const endDate = dayjs(cycle.endDate).startOf("day");
        return (
          (today.isAfter(startDate, "day") || today.isSame(startDate, "day")) &&
          (today.isBefore(endDate, "day") || today.isSame(endDate, "day"))
        );
      });

      if (currentCycle) {
        selectedCycle.value = currentCycle.id;
        await nextTick();
        fetchReviews();
      }
    }
  } catch (error) {
    // Error handling if needed
  }
};

syncLocalReviewCycleFromStore(store, {
  cyclesRef: reviewCyclesList,
  getLocalCycleId: () => selectedCycle.value,
  setLocalCycleId: (id) => {
    selectedCycle.value = id;
  },
  apply: fetchReviews,
});

const openReviewForm = (review) => {
  selectedReview.value = review;
  showReviewForm.value = true;
  lastModal.value = "review";
};
const closeReviewForm = () => {
  showReviewForm.value = false;
  selectedReview.value = null;
  lastModal.value = null;
  clearRouteQuery(["reviewId", "action"]);
  // Refresh list
  fetchReviews();
};
const onReviewSaved = () => {
  closeReviewForm();
};
const viewHistory = (review) => {
  selectedReview.value = review;
  showHistory.value = true;
  lastModal.value = "history";
};
const closeHistory = () => {
  showHistory.value = false;

  if (lastModal.value === "review") {
    showReviewForm.value = true;
    lastModal.value = null;
  } else {
    selectedReview.value = null;
    lastModal.value = null;
    clearRouteQuery(["reviewId", "action"]);
  }
};

const onShowHistoryFromModal = () => {
  showReviewForm.value = false;
  showHistory.value = true;
  lastModal.value = "review";
};

const openEmployeeKpisModal = (employeeData) => {
  selectedEmployeeReviews.value = employeeData;
  showEmployeeKpisModal.value = true;
};

const closeEmployeeKpisModal = () => {
  showEmployeeKpisModal.value = false;
  selectedEmployeeReviews.value = null;
  clearRouteQuery(["employeeId", "reviewId", "action"]);
};

const clearRouteQuery = (keys) => {
  const nextQuery = { ...route.query };
  let changed = false;

  keys.forEach((key) => {
    if (nextQuery[key] !== undefined) {
      delete nextQuery[key];
      changed = true;
    }
  });

  if (changed) {
    router.replace({ query: nextQuery });
  }
};

const tryHandleRouteQuery = () => {
  const employeeId = Number(route.query.employeeId);
  if (!employeeId || !groupedReviews.value.length) return;

  const employeeGroup = groupedReviews.value.find(
    (group) => Number(group.employeeId) === employeeId,
  );
  if (!employeeGroup) return;

  if (
    !showEmployeeKpisModal.value ||
    selectedEmployeeReviews.value?.employeeId !== employeeGroup.employeeId
  ) {
    openEmployeeKpisModal(employeeGroup);
  }

  const reviewId = Number(route.query.reviewId);
  if (!reviewId || queryHandled.value) return;

  const targetReview = employeeGroup.reviews.find(
    (review) => Number(review.id) === reviewId,
  );
  if (!targetReview) return;

  queryHandled.value = true;
  if (route.query.action === "review") {
    openReviewForm(targetReview);
    return;
  }

  if (route.query.action === "history") {
    viewHistory(targetReview);
  }
};

const statusIcon = (status) => {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return IconClockCircleTwoTone;
    case "self_reviewed":
      return IconUserOutlined;
    case "section_reviewed":
      return IconUserSwitchOutlined;
    case "department_reviewed":
      return IconSyncOutlined;
    case "manager_reviewed":
      return IconCheckCircleTwoTone;
    case "awaitingemployeefeedback":
    case "employee_feedback":
      return IconSmileTwoTone;
    case "pending_manager_approval":
      return IconClockCircleTwoTone;
    case "completed":
      return IconCheckCircleTwoTone;
    case "section_rejected":
    case "department_rejected":
    case "manager_rejected":
      return IconCloseCircleTwoTone;
    default:
      return IconExclamationCircleTwoTone;
  }
};

onMounted(async () => {
  await fetchCycles();
  // fetchReviews is called inside fetchCycles
});

watch(groupedReviews, () => {
  tryHandleRouteQuery();
});

watch(
  () => [route.query.employeeId, route.query.reviewId, route.query.action],
  () => {
    queryHandled.value = false;
    tryHandleRouteQuery();
  },
);
</script>

<style scoped>
.kpi-review-list {
  background-color: #f5f5f5;
  min-height: auto;
  padding: 24px;
}

.modern-card {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: none;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-icon {
  font-size: 24px;
  color: #1890ff;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: #262626;
}

.filter-section {
  margin-bottom: 16px;
}

.filters.modern-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 0;
  background: transparent;
  padding: 0;
  box-shadow: none;
}

.modern-filter-input {
  min-width: 180px;
  max-width: 260px;
  flex: 1 1 180px;
  margin-right: 0 !important;
  margin-bottom: 0 !important;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  font-size: 14px;
  height: 32px;
  transition: all 0.2s;
}

.modern-filter-input .ant-select-selector,
.modern-filter-input input {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  height: 30px !important;
  font-size: 14px;
}

.modern-filter-input:hover {
  border-color: #409eff;
}

.modern-filter-input:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.modern-table {
  border-radius: 8px;
}

.modern-table :deep(.ant-table-thead > tr > th) {
  background-color: #fafafa;
  font-weight: 600;
  color: #262626;
  border-bottom: 2px solid #f0f0f0;
}

.modern-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}

.modern-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f8f9fa;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid transparent;
}
/* Re-use status tag colors but nicer style */
.status-tag.pending { color: #faad14; background: #fffbe6; border-color: #ffe58f; }
.status-tag.self_reviewed { color: #13c2c2; background: #e6fffb; border-color: #87e8de; }
.status-tag.section_reviewed { color: #722ed1; background: #f9f0ff; border-color: #d3adf7; }
.status-tag.department_reviewed { color: #eb2f96; background: #fff0f6; border-color: #ffadd2; }
.status-tag.manager_reviewed { color: #1890ff; background: #e6f7ff; border-color: #91d5ff; }
.status-tag.employee_feedback { color: #52c41a; background: #f6ffed; border-color: #b7eb8f; }
.status-tag.pending_manager_approval { color: #fa8c16; background: #fff7e6; border-color: #ffd591; }
.status-tag.completed { color: #52c41a; background: #f6ffed; border-color: #b7eb8f; }
.status-tag.section_rejected, .status-tag.department_rejected, .status-tag.manager_rejected { color: #f5222d; background: #fff1f0; border-color: #ffa39e; }

.workflow-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workflow-next {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.action-btn {
  border-radius: 4px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}

/* Modal styles overrides */
:deep(.modern-modal .ant-modal-content) {
  border-radius: 12px;
}
:deep(.modern-modal .ant-modal-header) {
  border-radius: 12px 12px 0 0;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
:deep(.modern-modal .ant-modal-title) {
  font-size: 18px;
  color: #262626;
}

@media (max-width: 768px) {
  .kpi-review-list {
    padding: 16px;
  }
  .filters.modern-filters {
    flex-wrap: wrap;
  }
  .modern-filter-input {
    min-width: 100%;
  }
}

/* Modal custom style extension */
:deep(.modern-modal .review-section) {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
}
:deep(.modern-modal .review-section-title) {
  font-weight: 600;
  color: #409eff;
  margin-bottom: 6px;
}
:deep(.modern-modal .review-section .ant-rate) {
  font-size: 18px;
}
:deep(.modern-modal .ant-modal-footer) {
  padding: 12px 24px 0 24px;
  border-top: 1px solid #f0f0f0;
  background: #f9fafb;
  border-radius: 0 0 18px 18px;
}
@media (max-width: 600px) {
  .modern-table {
    font-size: 12px;
  }
  :deep(.modern-modal .ant-modal-body) {
    padding: 12px;
    gap: 10px;
  }
  :deep(.modern-modal .review-section) {
    padding: 10px 8px;
  }
}
</style>
