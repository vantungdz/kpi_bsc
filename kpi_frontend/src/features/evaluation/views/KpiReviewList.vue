<template>
  <div class="kpi-review-list" v-if="canViewKpiReview">
    <h2 class="kpi-title">
      <span style="display: flex; align-items: center; gap: 8px;">
        <icon-trophy-two-tone style="font-size: 1.6em; color: #409eff; margin-right: 6px;" />
        {{ $t("kpiReviewListTitle") }}
      </span>
    </h2>
    <div class="filters modern-filters">
      <a-input-group compact style="display: flex; gap: 12px; width: 100%;">
        <a-select v-model:value="selectedCycle" :options="cycleOptions" :placeholder="$t('selectCycle')"
          class="modern-filter-input" style="flex: 1; min-width: 160px;">
          <template #suffixIcon>
            <icon-calendar-outlined />
          </template>
        </a-select>
        <a-select v-model:value="selectedStatus" :options="statusOptions" :placeholder="$t('reviewStatus')"
          class="modern-filter-input" style="flex: 1; min-width: 160px;">
          <template #suffixIcon>
            <icon-filter-outlined />
          </template>
        </a-select>
        <a-input v-model:value="searchText" :placeholder="$t('searchKpiEmployee')" class="modern-filter-input" style="flex: 2; min-width: 180px;">
          <template #prefix>
            <icon-search-outlined />
          </template>
        </a-input>
      </a-input-group>
    </div>
    <div class="modern-table-wrapper">
      <a-table :columns="columns" :data-source="normalizedReviews" row-key="id" :loading="loading" bordered
        class="modern-table" style="margin-top: 24px" :pagination="{ pageSize: 10, showSizeChanger: true }">
        <template #bodyCell="slotProps">
          <template v-if="slotProps.column && slotProps.column.key === 'actions'">
            <a-tooltip :title="$t('review')" v-if="canReview">
              <a-button type="primary" size="small" @click="openReviewForm(slotProps.record.raw)" class="action-btn icon-btn">
                <icon-edit-outlined />
              </a-button>
            </a-tooltip>
            <a-tooltip :title="$t('reviewHistory')">
              <a-button type="default" size="small" @click="viewHistory(slotProps.record.raw)" class="action-btn icon-btn">
                <icon-history-outlined />
              </a-button>
            </a-tooltip>
          </template>
          <template v-else-if="slotProps.column && slotProps.column.key === 'status'">
            <span v-if="slotProps.record.status" :class="['status-tag', slotProps.record.status.toLowerCase()]">
              <component :is="statusIcon(slotProps.record.status)" style="margin-right: 6px; font-size: 1.1em; vertical-align: middle;" />
              {{ $t('statusReview.' + slotProps.record.status.toLowerCase()) }}
            </span>
          </template>
          <template v-else>
            {{ slotProps.text }}
          </template>
        </template>
      </a-table>
    </div>
    <ReviewFormModal v-if="showReviewForm" :review="selectedReview" :visible="showReviewForm" @close="closeReviewForm"
      @saved="onReviewSaved" @show-history="onShowHistoryFromModal" modal-class="modern-modal" />
    <ReviewHistoryModal v-if="showHistory" :review="selectedReview" :visible="showHistory" @close="closeHistory"
      class="modern-modal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  getKpiReviewList,
  getReviewCycles,
} from "@/core/services/kpiReviewApi";
import ReviewFormModal from "./ReviewFormModal.vue";
import ReviewHistoryModal from "./ReviewHistoryModal.vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
// Ant Design Vue icons
import {
  TrophyTwoTone as IconTrophyTwoTone,
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
} from '@ant-design/icons-vue';

const { t } = useI18n();

const reviews = ref([]);
const loading = computed(() => store.getters["loading/isLoading"]);
const selectedCycle = ref(null);
const selectedStatus = ref(null);
const searchText = ref("");
const showReviewForm = ref(false);
const showHistory = ref(false);
const selectedReview = ref(null);
const cycleOptions = ref([]);
const statusOptions = [
  { label: t("all"), value: "" },
  { label: t("pendingReview"), value: "PENDING" },
  { label: t("managerReviewed"), value: "MANAGER_REVIEWED" },
  { label: t("awaitingEmployeeFeedback"), value: "EMPLOYEE_FEEDBACK" },
  { label: t("completed"), value: "COMPLETED" },
];
const manualSearch = ref(false);
const lastModal = ref(null); // 'review' hoặc 'history'

const columns = computed(() => [
  { title: t("kpiName"), key: "kpiName", dataIndex: "kpiName" },
  { title: t("employee"), key: "employee", dataIndex: "employee" },
  { title: t("target"), key: "targetValue", dataIndex: "targetValue" },
  { title: t("actualResult"), key: "actualValue", dataIndex: "actualValue" },
  { title: t("status"), key: "status", dataIndex: "status" },
  { title: t("score"), key: "score", dataIndex: "score" },
  { title: t("actions"), key: "actions" },
]);

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
        (`${r.employee?.first_name || ''} ${r.employee?.last_name || ''}`.toLowerCase().includes(s))
    );
  }
  return data;
});

const normalizedReviews = computed(() => {
  return filteredReviews.value.map((r) => ({
    id: r.id,
    kpiName: r.kpi.name || "",
    employee: `${r.employee?.first_name} ${r.employee?.last_name}` || "",
    targetValue: `${Number(r.targetValue).toLocaleString()} ${r.kpi.unit}` ?? "",
    actualValue: `${Number(r.actualValue).toLocaleString()} ${r.kpi.unit}` ?? "",
    status: r.status || "",
    score: `${Number(r.score).toLocaleString()} `?? "",
    raw: r, // giữ lại bản gốc để truyền cho modal nếu cần
  }));
});

const fetchReviews = async () => {
  store.dispatch("loading/startLoading");
  try {
    console.log('[KPI Review] fetchReviews selectedCycle:', selectedCycle.value, 'selectedStatus:', selectedStatus.value);
    const params = {
      cycle: selectedCycle.value,
      status: selectedStatus.value
    };
    // Chỉ truyền search nếu bấm nút search
    if (searchText.value && manualSearch.value) {
      params.search = searchText.value;
    }
    console.log('[KPI Review] Params gửi lên API:', params); // Thêm log debug
    const res = await getKpiReviewList(params);
    reviews.value = res;
  } finally {
    store.dispatch("loading/stopLoading");
  }
};


const fetchCycles = async () => {
  const res = await getReviewCycles();
  cycleOptions.value = res.map((c) => ({ label: c.name, value: c.id }));
};

const openReviewForm = (review) => {
  selectedReview.value = review;
  showReviewForm.value = true;
  lastModal.value = 'review';
};
const closeReviewForm = () => {
  showReviewForm.value = false;
  selectedReview.value = null;
  lastModal.value = null;
};
const onReviewSaved = () => {
  closeReviewForm();
  fetchReviews();
};
const viewHistory = (review) => {
  selectedReview.value = review;
  showHistory.value = true;
  lastModal.value = 'history';
};
const closeHistory = () => {
  showHistory.value = false;
  // Nếu vừa chuyển từ modal review sang thì mở lại modal review
  if (lastModal.value === 'review') {
    showReviewForm.value = true;
    lastModal.value = null;
  } else {
    selectedReview.value = null;
    lastModal.value = null;
  }
};

const onShowHistoryFromModal = () => {
  showReviewForm.value = false;
  showHistory.value = true;
  lastModal.value = 'review';
};

const store = useStore();
const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
function hasPermission(action, resource, scopes) {
  if (!Array.isArray(scopes)) scopes = [scopes];
  return userPermissions.value?.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scopes[0] ? scopes.includes(p.scope) : true)
  );
}
const canViewKpiReview = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW, ['section', 'department', 'manager'])
);
const canReview = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW, ['section', 'department', 'manager'])
);

// Status icon mapping
const statusIcon = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return IconClockCircleTwoTone;
    case 'self_reviewed':
      return IconUserOutlined;
    case 'section_reviewed':
      return IconUserSwitchOutlined;
    case 'department_reviewed':
      return IconSyncOutlined;
    case 'manager_reviewed':
      return IconCheckCircleTwoTone;
    case 'awaitingemployeefeedback':
    case 'employee_feedback':
      return IconSmileTwoTone;
    case 'completed':
      return IconCheckCircleTwoTone;
    default:
      return IconExclamationCircleTwoTone;
  }
};

// Đảm bảo fetchReviews chỉ gọi sau khi fetchCycles xong
onMounted(async () => {
  console.log('[KPI Review] onMounted');
  await fetchCycles();
  fetchReviews();
});

</script>

<style scoped>
.kpi-review-list {
  padding: 24px;
}
.kpi-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 24px;
  color: #1a237e;
  display: flex;
  align-items: center;
}
.filters.modern-filters {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 6px #e6f7ff22;
  padding: 18px 18px 10px 18px;
  flex-wrap: wrap;
}
.modern-filter-input {
  min-width: 180px;
  max-width: 260px;
  flex: 1 1 180px;
  margin-right: 0 !important;
  margin-bottom: 0 !important;
  background: #f7faff;
  border-radius: 6px;
  border: 1px solid #eaf2fb;
  box-shadow: 0 1px 2px #e6f7ff11;
  font-size: 15px;
  height: 38px;
  transition: border 0.2s;
}
.modern-filter-input .ant-select-selector,
.modern-filter-input input {
  background: #f7faff !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 6px !important;
  height: 38px !important;
  font-size: 15px;
  padding-left: 12px;
}
.modern-filter-input .ant-select-selection-placeholder,
.modern-filter-input input::placeholder {
  color: #bfbfbf !important;
  font-size: 15px;
}
.modern-filter-input:focus-within,
.modern-filter-input:focus {
  border: 1.5px solid #409eff !important;
  box-shadow: 0 0 0 2px #e6f7ff55 !important;
}
.modern-table {
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.07);
  overflow: hidden;
}
.modern-table .ant-table-thead > tr > th {
  background: #f5f7fa;
  font-weight: 600;
  font-size: 15px;
  color: #222;
  border-bottom: 2px solid #e5e7eb;
  padding: 14px 12px;
}
.modern-table .ant-table-tbody > tr > td {
  background: #fff;
  font-size: 14px;
  padding: 12px 10px;
  border-bottom: 1px solid #f0f0f0;
}
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  text-transform: capitalize;
}
.status-tag.pending {
  background: #f59e42;
}

.status-tag.self_reviewed {
  background: #05574c;
}
.status-tag.section_reviewed {
  background: #e944e9;
}
.status-tag.department_reviewed {
  background: #e02884;
}
.status-tag.manager_reviewed {
  background: #409eff;
}
.status-tag.awaitingemployeefeedback,
.status-tag.employee_feedback {
  background: #13c2c2;
}
.status-tag.completed {
  background: #52c41a;
}
.action-btn {
  margin-right: 8px;
  border-radius: 8px;
  font-weight: 500;
}
.action-btn:last-child {
  margin-right: 0;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  font-size: 1.1em;
  border-radius: 8px;
  box-shadow: 0 1px 2px #e6f7ff11;
  transition: background 0.15s;
}
.icon-btn:hover {
  background: #e6f7ff;
}
/* Modal custom style */
:deep(.modern-modal .ant-modal-content) {
  border-radius: 18px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.13);
  padding: 0 0 24px 0;
}
:deep(.modern-modal .ant-modal-header) {
  border-radius: 18px 18px 0 0;
  background: #f5f7fa;
  padding: 20px 24px 12px 24px;
}
:deep(.modern-modal .ant-modal-title) {
  font-size: 20px;
  font-weight: 700;
  color: #222;
}
:deep(.modern-modal .ant-modal-body) {
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
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
@media (max-width: 900px) {
  .filters.modern-filters {
    flex-direction: column;
    gap: 10px;
    padding: 10px 6px 6px 6px;
  }
  .modern-filter-input {
    min-width: 120px;
    max-width: 100%;
    font-size: 13px;
    height: 32px;
  }
  .modern-filter-input .ant-select-selector,
  .modern-filter-input input {
    height: 32px !important;
    font-size: 13px;
    padding-left: 8px;
  }
}
</style>
