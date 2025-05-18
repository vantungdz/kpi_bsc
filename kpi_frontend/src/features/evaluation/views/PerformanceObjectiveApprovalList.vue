<template>
  <div class="performance-objective-approval-list-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboard") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{
        $t("performanceObjectiveApprovalTitle")
      }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-card :title="cardTitle" :bordered="false" class="rounded-xl shadow-md">
      <a-spin :spinning="isLoading" :tip="$t('loadingList')">
        <a-alert
          v-if="loadingError"
          type="error"
          show-icon
          closable
          style="margin-bottom: 16px"
          :message="$t('loadingError')"
          @close="loadingError = null"
        />

        <a-table
          v-if="!loadingError && managedOverallReviews.length > 0"
          :columns="columns"
          :data-source="managedOverallReviews"
          :row-key="'id'"
          bordered
          size="small"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employeeName'">
              <span>
                {{ record.reviewedBy?.first_name || "" }}
                {{ record.reviewedBy?.last_name || "" }}
              </span>
            </template>
            <template v-else-if="column.key === 'reviewerName'">
              <span>
                {{ record.reviewer?.first_name || "" }}
                {{ record.reviewer?.last_name || "" }}
                ({{ record.reviewer?.username || $t("unknown") }})
              </span>
            </template>
            <template v-else-if="column.key === 'totalWeightedScoreSupervisor'">
              {{
                typeof record.totalWeightedScore === 'number' && !isNaN(record.totalWeightedScore)
                  ? Number(record.totalWeightedScore).toFixed(2)
                  : (record.totalWeightedScore && !isNaN(Number(record.totalWeightedScore)))
                    ? Number(record.totalWeightedScore).toFixed(2)
                    : "0"
              }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getOverallReviewStatusColor(record.status)">
                {{ getOverallReviewStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'updatedAt'">
              {{ formatDate(record.updatedAt) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="goToKpiReview(record)"
                  :title="$t('viewDetailsAndHistory')"
                >
                  <eye-outlined /> {{ $t("details") }}
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>

        <a-empty
          v-if="
            !loadingError &&
            managedOverallReviews.length === 0 &&
            !isLoading
          "
          :description="$t('noPendingObjectiveEvaluations')"
        />
      </a-spin>
    </a-card>

    <!-- Reject Modal -->
    <a-modal
      :open="isRejectModalVisible"
      :title="$t('rejectObjectiveEvaluation')"
      @ok="handleReject"
      @cancel="closeRejectModal"
      :confirm-loading="
        isProcessingApproval && currentActionItemId === itemToReject?.id
      "
      :ok-text="$t('confirmReject')"
      :cancel-text="$t('cancel')"
      destroyOnClose
      @afterClose="resetRejectModalState"
    >
      <a-alert
        v-if="rejectError"
        :message="rejectError"
        type="error"
        show-icon
        style="margin-bottom: 10px"
      />
      <p v-if="itemToReject" style="margin-bottom: 10px">
        {{
          $t("rejectEvaluationForEmployee", {
            employeeName: `${itemToReject.employee?.first_name} ${itemToReject.employee?.last_name}`,
          })
        }}
      </p>
      <a-form-item
        :label="$t('reasonRequired')"
        :validate-status="rejectError ? 'error' : ''"
        :help="rejectError"
      >
        <a-textarea
          v-model:value="rejectionReason"
          :placeholder="$t('enterRejectReason')"
          :rows="4"
        />
      </a-form-item>
    </a-modal>

    <!-- Detail Modal (Placeholder) -->
    <a-modal
      :open="isDetailModalVisible"
      :title="$t('objectiveEvaluationDetailsAndHistory')"
      @cancel="closeDetailModal"
      :width="900"
      :footer="null"
      destroyOnClose
      @afterClose="resetDetailModalState"
    >
      <template v-if="selectedReview">
        <h4>{{ $t('employeeName') }}: {{ selectedReview.employee?.first_name }} {{ selectedReview.employee?.last_name }} ({{ selectedReview.employee?.username }})</h4>
        <a-descriptions bordered :column="1" size="small" style="margin-bottom: 16px">
          <a-descriptions-item :label="$t('status')">
            <a-tag :color="getOverallReviewStatusColor(selectedReview.status)">
              {{ getOverallReviewStatusText(selectedReview.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('totalWeightedScoreSupervisor')">
            {{ selectedReview.totalWeightedScore ? Number(selectedReview.totalWeightedScore).toFixed(2) : 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('lastUpdated')">
            {{ formatDate(selectedReview.updatedAt) }}
          </a-descriptions-item>
        </a-descriptions>
        <h4 v-if="selectedReview.kpis">{{ $t('kpiReviewList') }}</h4>
        <a-table
          v-if="selectedReview.kpis"
          :columns="kpiColumns"
          :data-source="selectedReview.kpis"
          :row-key="'assignmentId'"
          size="small"
          bordered
          :pagination="false"
          style="margin-bottom: 16px"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'kpiName'">
              {{ record.kpiName }}
            </template>
            <template v-else-if="column.key === 'selfComment'">
              {{ record.selfComment || $t('noComment') }}
            </template>
            <template v-else-if="column.key === 'selfScore'">
              <a-rate :value="record.selfScore" disabled />
            </template>
            <template v-else-if="column.key === 'managerComment'">
              {{ record.managerComment || $t('noComment') }}
            </template>
            <template v-else-if="column.key === 'managerScore'">
              <a-rate :value="record.managerScore" disabled />
            </template>
          </template>
        </a-table>
        <h4 v-if="selectedReview.employeeComment">{{ $t('employeeFeedback') }}</h4>
        <a-descriptions v-if="selectedReview.employeeComment" bordered :column="1" size="small">
          <a-descriptions-item :label="$t('feedbackDate')">
            {{ formatDate(selectedReview.employeeFeedbackDate) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('feedbackContent')">
            <p style="white-space: pre-wrap">{{ selectedReview.employeeComment }}</p>
          </a-descriptions-item>
        </a-descriptions>
      </template>
      <template v-else>
        <a-empty :description="$t('noData')" />
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, h } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  notification,
  Empty as AEmpty,
  Spin as ASpin,
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  Card as ACard,
  Table as ATable,
  Tag as ATag,
  Alert as AAlert,
  Modal as AModal,
  Button as AButton,
  Space as ASpace,
  FormItem as AFormItem,
  Textarea as ATextarea,
} from "ant-design-vue";
import {
  EyeOutlined,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import { useRouter } from 'vue-router';

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();

const managedOverallReviews = ref([]);
const isLoading = ref(false);
const loadingError = ref(null);
const isProcessingApproval = computed(() => store.getters["kpiEvaluations/isProcessingObjectiveEvalApproval"]);
const currentActionItemId = ref(null);

// Modal State
const isRejectModalVisible = ref(false);
const itemToReject = ref(null);
const rejectionReason = ref("");
const rejectError = ref(null);
const isDetailModalVisible = ref(false);
const selectedReview = ref(null);

const cardTitle = computed(() => $t("performanceObjectiveApprovalList"));

// Define OverallReviewStatus and color/text helpers (replace with import if available)
const OverallReviewStatus = {
  SECTION_REVIEW_PENDING: "SECTION_REVIEW_PENDING",
  DEPARTMENT_REVIEW_PENDING: "DEPARTMENT_REVIEW_PENDING",
  MANAGER_REVIEW_PENDING: "MANAGER_REVIEW_PENDING",
  MANAGER_REVIEWED: "MANAGER_REVIEWED",
  EMPLOYEE_FEEDBACK_PENDING: "EMPLOYEE_FEEDBACK_PENDING",
  EMPLOYEE_RESPONDED: "EMPLOYEE_RESPONDED",
  COMPLETED: "COMPLETED",
  REJECTED_BY_SECTION: "REJECTED_BY_SECTION",
  REJECTED_BY_DEPARTMENT: "REJECTED_BY_DEPARTMENT",
  REJECTED_BY_MANAGER: "REJECTED_BY_MANAGER",
};
const OverallReviewStatusColor = {
  SECTION_REVIEW_PENDING: "orange",
  DEPARTMENT_REVIEW_PENDING: "gold",
  MANAGER_REVIEW_PENDING: "blue",
  MANAGER_REVIEWED: "green",
  EMPLOYEE_FEEDBACK_PENDING: "purple",
  EMPLOYEE_RESPONDED: "cyan",
  COMPLETED: "green",
  REJECTED_BY_SECTION: "red",
  REJECTED_BY_DEPARTMENT: "red",
  REJECTED_BY_MANAGER: "red",
  default: "gray",
};
const getOverallReviewStatusText = (status) => {
  const map = {
    MANAGER_REVIEWED: $t("status_array.MANAGER_REVIEWED"),
    EMPLOYEE_FEEDBACK_PENDING: $t("status_array.EMPLOYEE_FEEDBACK_PENDING"),
    EMPLOYEE_RESPONDED: $t("status_array.EMPLOYEE_RESPONDED"),
    COMPLETED: $t("status_array.COMPLETED"),
    PENDING_REVIEW: $t("status_array.PENDING_REVIEW"),
    unknown: $t("status_array.unknown"),
  };
  return map[status] || map.unknown;
};
const getOverallReviewStatusColor = (status) => OverallReviewStatusColor[status] || OverallReviewStatusColor.default;

const columns = computed(() => [
  {
    title: $t("employeeName"),
    key: "employeeName",
    width: 200,
    ellipsis: true,
    customRender: ({ record }) => {
      return record.reviewedBy
        ? `${record.reviewedBy.first_name} ${record.reviewedBy.last_name}`
        : $t("unknown");
    },
  },
  {
    title: $t("reviewer"),
    key: "reviewerName",
    width: 200,
    ellipsis: true,
    customRender: ({ record }) => record.reviewedBy
      ? `${record.reviewedBy.first_name || ''} ${record.reviewedBy.last_name || ''} (${record.reviewedBy.username || $t('unknown')})`
      : $t('unknown'),
  },
  {
    title: $t("totalWeightedScoreSupervisor"),
    key: "totalWeightedScoreSupervisor",
    align: "right",
    width: 150,
    customRender: ({ record }) => record.totalWeightedScore && !isNaN(Number(record.totalWeightedScore))
      ? Number(record.totalWeightedScore).toFixed(2)
      : "N/A",
  },
  {
    title: $t("status"),
    key: "status",
    align: "center",
    width: 180,
    customRender: ({ record }) =>
      h(ATag, { color: getOverallReviewStatusColor(record.status) }, () => getOverallReviewStatusText(record.status)),
  },
  {
    title: $t("lastUpdated"),
    key: "updatedAt",
    width: 150,
    customRender: ({ record }) => formatDate(record.updatedAt),
  },
  {
    title: $t("actions"),
    key: "actions",
    align: "center",
    width: 220,
    fixed: "right",
    customRender: ({ record }) =>
      h(ASpace, null, [
        h(AButton, {
          type: "link",
          size: "small",
          onClick: () => goToKpiReview(record),
          title: $t("viewDetailsAndHistory"),
        }, [h(EyeOutlined), " ", $t("details")]),
      ]),
  },
]);

const formatDate = (dateString) => dateString ? dayjs(dateString).format("YYYY-MM-DD HH:mm") : "";

// Lọc bỏ các bản review đã hoàn thành (status === 'COMPLETED')
// const filteredOverallReviews = computed(() =>
//   managedOverallReviews.value.filter(r => r.status !== 'COMPLETED')
// );

const fetchData = async () => {
  isLoading.value = true;
  loadingError.value = null;
  try {
    // Call the new API to get all managed employees' OverallReview records
    const response = await store.dispatch("kpiEvaluations/fetchManagedEmployeeOverallReviews");
    managedOverallReviews.value = response || [];
  } catch (error) {
    loadingError.value = $t("errorLoadingApprovalList");
    managedOverallReviews.value = [];
  } finally {
    isLoading.value = false;
  }
};

const handleReject = async () => {
  if (!itemToReject.value || !itemToReject.value.id) return;
  if (!rejectionReason.value || rejectionReason.value.trim() === "") {
    rejectError.value = $t("reasonRequired");
    return;
  }
  currentActionItemId.value = itemToReject.value.id;
  rejectError.value = null;
  let actionName = null;
  switch (itemToReject.value.status) {
    case OverallReviewStatus.SECTION_REVIEW_PENDING:
      actionName = "kpiEvaluations/rejectOverallReviewSection";
      break;
    case OverallReviewStatus.DEPARTMENT_REVIEW_PENDING:
      actionName = "kpiEvaluations/rejectOverallReviewDept";
      break;
    case OverallReviewStatus.MANAGER_REVIEW_PENDING:
      actionName = "kpiEvaluations/rejectOverallReviewManager";
      break;
    default:
      notification.error({
        message: $t("error"),
        description: $t("invalidStatusForRejection", { status: getOverallReviewStatusText(itemToReject.value.status) }),
      });
      currentActionItemId.value = null;
      return;
  }
  try {
    await store.dispatch(actionName, { reviewId: itemToReject.value.id, comment: rejectionReason.value });
    closeRejectModal();
    fetchData();
  } catch (error) {
    rejectError.value = $t("errorDuringRejection");
  } finally {
    if (!rejectError.value) currentActionItemId.value = null;
  }
};
const closeRejectModal = () => {
  isRejectModalVisible.value = false;
};
const resetRejectModalState = () => {
  itemToReject.value = null;
  rejectionReason.value = "";
  rejectError.value = null;
};

const closeDetailModal = () => {
  isDetailModalVisible.value = false;
};
const resetDetailModalState = () => {
  selectedReview.value = null;
};
// Thêm hàm chuyển trang sang KpiReview
const goToKpiReview = (record) => {
  if (!record || !record.reviewedBy || !record.cycleId) return;
  // Hỗ trợ cả router.push({ name, params }) và router.push(path)
  if (router.resolve({ name: "KpiReview", params: { employeeId: record.reviewedBy.id, cycleId: record.cycleId } }).href !== `/kpi/review`) {
    // Nếu route có dạng /kpi-review/:employeeId/:cycleId
    router.push({
      name: "KpiReview",
      params: {
        employeeId: record.reviewedBy.id,
        cycleId: record.cycleId,
      },
    });
  } else {
    // Nếu chỉ có /kpi/review thì fallback sang truyền query
    router.push({
      name: "KpiReview",
      query: {
        targetId: record.reviewedBy.id,
        cycleId: record.cycleId,
      },
    });
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.performance-objective-approval-list-page {
  padding: 24px;
}
</style>
