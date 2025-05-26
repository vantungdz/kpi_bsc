<template>
  <div class="kpi-review-list" v-if="canViewKpiReview">
    <h2 class="kpi-title">{{ $t("kpiReviewListTitle") }}</h2>
    <div class="filters">
      <a-select
        v-model="selectedCycle"
        :options="cycleOptions"
        :placeholder="$t('selectCycle')"
        style="width: 200px; margin-right: 16px"
      />
      <a-select
        v-model="selectedStatus"
        :options="statusOptions"
        :placeholder="$t('reviewStatus')"
        style="width: 200px; margin-right: 16px"
      />
      <a-input
        v-model="searchText"
        :placeholder="$t('searchKpiEmployee')"
        style="width: 250px"
      />
      <a-button type="primary" @click="fetchReviews" style="margin-left: 16px">
        {{ $t("search") }}
      </a-button>
    </div>
    <div class="modern-table-wrapper">
      <a-table
        :columns="columns"
        :data-source="normalizedReviews"
        row-key="id"
        :loading="loading"
        bordered
        class="modern-table"
        style="margin-top: 24px"
        :pagination="{ pageSize: 10, showSizeChanger: true }"
      >
        <template #bodyCell="slotProps">
          <template
            v-if="slotProps.column && slotProps.column.key === 'actions'"
          >
            <a-button
              type="primary"
              size="small"
              @click="openReviewForm(slotProps.record.raw)"
              class="action-btn"
              v-if="canReview"
              >{{ $t("review") }}</a-button
            >
            <a-button
              type="default"
              size="small"
              @click="viewHistory(slotProps.record.raw)"
              class="action-btn"
              >{{ $t("reviewHistory") }}</a-button
            >
          </template>
          <template
            v-else-if="slotProps.column && slotProps.column.key === 'status'"
          >
            <span
              :class="['status-tag', slotProps.record.status.toLowerCase()]"
            >
              {{ $t(slotProps.record.status.toLowerCase()) }}
            </span>
          </template>
          <template v-else>
            {{ slotProps.text }}
          </template>
        </template>
      </a-table>
    </div>
    <a-empty
      v-if="!normalizedReviews.length && !loading"
      :description="$t('noDataMatch')"
    />
    <ReviewFormModal
      v-if="showReviewForm"
      :review="selectedReview"
      :visible="showReviewForm"
      @close="closeReviewForm"
      @saved="onReviewSaved"
      modal-class="modern-modal"
    />
    <ReviewHistoryModal
      v-if="showHistory"
      :review="selectedReview"
      :visible="showHistory"
      @close="closeHistory"
      class="modern-modal"
    />
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

const { t } = useI18n();

const reviews = ref([]);
const loading = ref(false);
const selectedCycle = ref();
const selectedStatus = ref();
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

const columns = computed(() => [
  { title: t("kpiName"), key: "kpiName", dataIndex: "kpiName" },
  { title: t("employee"), key: "employee", dataIndex: "employee" },
  { title: t("cycle"), key: "cycle", dataIndex: "cycle" },
  { title: t("target"), key: "targetValue", dataIndex: "targetValue" },
  { title: t("actualResult"), key: "actualValue", dataIndex: "actualValue" },
  { title: t("status"), key: "status", dataIndex: "status" },
  { title: t("score"), key: "score", dataIndex: "score" },
  { title: t("actions"), key: "actions" },
]);

const filteredReviews = computed(() => {
  let data = reviews.value;
  if (selectedCycle.value)
    data = data.filter((r) => r.cycle === selectedCycle.value);
  if (selectedStatus.value)
    data = data.filter((r) => r.status === selectedStatus.value);
  if (searchText.value) {
    const s = searchText.value.toLowerCase();
    data = data.filter(
      (r) =>
        r.kpi?.name?.toLowerCase().includes(s) ||
        r.employee?.fullName?.toLowerCase().includes(s)
    );
  }
  return data;
});

const normalizedReviews = computed(() => {
  return filteredReviews.value.map((r) => ({
    id: r.id,
    kpiName: r.kpi?.name || "",
    employee: r.employee?.fullName || "",
    cycle: r.cycle || "",
    targetValue: r.targetValue ?? "",
    actualValue: r.actualValue ?? "",
    status: r.status || "",
    score: r.score ?? "",
    raw: r, // giữ lại bản gốc để truyền cho modal nếu cần
  }));
});

const fetchReviews = async () => {
  loading.value = true;
  try {
    const res = await getKpiReviewList({
      cycle: selectedCycle.value,
      status: selectedStatus.value,
    });
    reviews.value = res;
  } finally {
    loading.value = false;
  }
};

const fetchCycles = async () => {
  const res = await getReviewCycles();
  cycleOptions.value = res.map((c) => ({ label: c.name, value: c.id }));
};

const openReviewForm = (review) => {
  selectedReview.value = review;
  showReviewForm.value = true;
};
const closeReviewForm = () => {
  showReviewForm.value = false;
  selectedReview.value = null;
};
const onReviewSaved = () => {
  closeReviewForm();
  fetchReviews();
};
const viewHistory = (review) => {
  selectedReview.value = review;
  showHistory.value = true;
};
const closeHistory = () => {
  showHistory.value = false;
  selectedReview.value = null;
};

const store = useStore();
const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action === action && p.resource === resource
  );
}
const canViewKpiReview = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE_COMPANY) ||
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_VALUE_DEPARTMENT)
);
const canReview = computed(
  () =>
    hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.KPI_VALUE_COMPANY) ||
    hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.KPI_VALUE_DEPARTMENT) ||
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE_COMPANY) ||
    hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE_DEPARTMENT)
);

onMounted(() => {
  fetchCycles();
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
}
.filters {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
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
  display: inline-block;
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
</style>
