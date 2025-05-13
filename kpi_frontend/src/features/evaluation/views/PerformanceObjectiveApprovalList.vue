<template>
  <div class="performance-objective-approval-list-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboard") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("performanceObjectiveApprovalTitle") }}</a-breadcrumb-item>
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
          v-if="!loadingError && pendingObjectiveEvaluations.length > 0"
          :columns="columns"
          :data-source="pendingObjectiveEvaluations"
          :row-key="'id'"
          bordered
          size="small"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employeeName'">
              <span>
                {{ record.employee?.first_name || "" }}
                {{ record.employee?.last_name || "" }}
                ({{ record.employee?.username || $t('unknown') }})
              </span>
            </template>
            <template v-else-if="column.key === 'evaluatorName'">
              <span>
                {{ record.evaluator?.first_name || "" }}
                {{ record.evaluator?.last_name || "" }}
                ({{ record.evaluator?.username || $t('unknown') }})
              </span>
            </template>
            <template v-else-if="column.key === 'totalWeightedScoreSupervisor'">
              {{ record.total_weighted_score_supervisor?.toFixed(2) ?? "N/A" }}
            </template>
            <template v-else-if="column.key === 'averageScoreSupervisor'">
              {{ record.average_score_supervisor?.toFixed(2) ?? "N/A" }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getObjectiveEvaluationStatusColor(record.status)">
                {{ getObjectiveEvaluationStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'updated_at'">
              {{ formatDate(record.updated_at) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="openDetailModal(record)"
                  :title="$t('viewDetailsAndHistory')"
                >
                  <eye-outlined /> {{ $t("details") }}
                </a-button>
                <a-button
                  type="primary"
                  size="small"
                  @click="handleApprove(record)"
                  :loading="isProcessingApproval && currentActionItemId === record.id"
                  :disabled="isProcessingApproval && currentActionItemId !== record.id"
                  :title="$t('approve')"
                >
                  <check-outlined /> {{ $t("approve") }}
                </a-button>
                <a-button
                  danger
                  size="small"
                  @click="openRejectModal(record)"
                  :disabled="isProcessingApproval"
                  :title="$t('reject')"
                >
                  <close-outlined /> {{ $t("reject") }}
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>

        <a-empty
          v-if="!loadingError && pendingObjectiveEvaluations.length === 0 && !isLoading"
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
      :confirm-loading="isProcessingApproval && currentActionItemId === itemToReject?.id"
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
        {{ $t('rejectEvaluationForEmployee', { employeeName: `${itemToReject.employee?.first_name} ${itemToReject.employee?.last_name}` }) }}
      </p>
      <a-form-item :label="$t('reasonRequired')" :validate-status="rejectError ? 'error' : ''" :help="rejectError">
        <a-textarea v-model:value="rejectionReason" :placeholder="$t('enterRejectReason')" :rows="4" />
      </a-form-item>
    </a-modal>

    <!-- Detail Modal (Placeholder) -->
    <a-modal
      :open="isDetailModalVisible"
      :title="$t('objectiveEvaluationDetailsAndHistory')"
      @cancel="closeDetailModal"
      :width="1000"
      :footer="null"
      destroyOnClose
      @afterClose="resetDetailModalState"
    >
      <p>{{ $t('detailsWillBeShownHere') }}</p>
      <!-- Nội dung chi tiết và lịch sử sẽ được thêm vào đây -->
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { notification, Empty as AEmpty, Spin as ASpin, Breadcrumb as ABreadcrumb, BreadcrumbItem as ABreadcrumbItem, Card as ACard, Table as ATable, Tag as ATag, Alert as AAlert, Modal as AModal, Button as AButton, Space as ASpace, FormItem as AFormItem, Textarea as ATextarea } from 'ant-design-vue';
import { EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
// TODO: Import constants for ObjectiveEvaluationStatus (ObjectiveEvaluationStatus, ObjectiveEvaluationStatusColor, getObjectiveEvaluationStatusText)
import {
    ObjectiveEvaluationStatus,
    ObjectiveEvaluationStatusColor,
    getObjectiveEvaluationStatusText as getStatusTextMap, // Renamed for clarity
} from "@/core/constants/objectiveEvaluationStatus";
const { t: $t } = useI18n();
const store = useStore();

const pendingObjectiveEvaluations = ref([]);
const isLoading = computed(() => store.getters['kpiEvaluations/isLoadingPendingObjectiveEvaluations']);
const loadingError = ref(null);
const isProcessingApproval = computed(() => store.getters['kpiEvaluations/isProcessingObjectiveEvalApproval']);
const currentUser = computed(() => store.getters['auth/user']);
const currentActionItemId = ref(null);

// Reject Modal State
const isRejectModalVisible = ref(false);
const itemToReject = ref(null);
const rejectionReason = ref('');
const rejectError = ref(null);

// Detail Modal State
const isDetailModalVisible = ref(false);
const selectedEvaluation = ref(null);
const evaluationHistory = ref([]);
const isLoadingHistory = ref(false);
const historyError = ref(null);

const cardTitle = computed(() => $t('performanceObjectiveApprovalList')); // Placeholder, can be dynamic based on role

const statusTextMap = computed(() => getStatusTextMap($t));

const columns = computed(() => [
  { title: $t('employeeName'), key: 'employeeName', width: 200, ellipsis: true },
  { title: $t('evaluator'), key: 'evaluatorName', width: 200, ellipsis: true },
  { title: $t('totalWeightedScoreSupervisor'), dataIndex: 'total_weighted_score_supervisor', key: 'totalWeightedScoreSupervisor', align: 'right', width: 150 },
  { title: $t('averageScoreSupervisor'), dataIndex: 'average_score_supervisor', key: 'averageScoreSupervisor', align: 'right', width: 150 },
  { title: $t('status'), dataIndex: 'status', key: 'status', width: 180, align: 'center' },
    { title: $t('lastUpdated'), dataIndex: 'updated_at', key: 'updated_at', width: 150, sorter: (a, b) => dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix() },
    { title: $t('actions'), key: 'actions', align: 'center', width: 220, fixed: 'right' },
]);

// Placeholder functions - to be implemented
const getObjectiveEvaluationStatusColor = (status) => {
    return ObjectiveEvaluationStatusColor[status] || ObjectiveEvaluationStatusColor.default;
};
const getObjectiveEvaluationStatusText = (status) => {
    return statusTextMap.value[status] || statusTextMap.value.unknown;
};
const formatDate = (dateString) => dateString ? dayjs(dateString).format('YYYY-MM-DD HH:mm') : '';

const fetchData = async () => {
    if (!currentUser.value || !currentUser.value.id) {
        loadingError.value = $t('cannotIdentifyUser');
        return;
    }
    loadingError.value = null;
    try {
        const data = await store.dispatch('kpiEvaluations/fetchPendingObjectiveEvaluations');
        pendingObjectiveEvaluations.value = data || [];
    } catch (error) {
        loadingError.value = store.getters['kpiEvaluations/getPendingObjectiveEvaluationsError'] || $t('errorLoadingApprovalList');
        pendingObjectiveEvaluations.value = [];
    }
};

const handleApprove = async (record) => {
    if (!record || !record.id) return;
    currentActionItemId.value = record.id;

    let actionName = null;
    const status = record.status;

    // Determine the correct Vuex action based on the current status
    // This logic assumes the backend determines the next approver level
    // The frontend just needs to call the correct "approve" action for the current pending level.
    if (status === ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL) {
        actionName = 'kpiEvaluations/approveObjectiveEvaluationSection';
    } else if (status === ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL) {
        actionName = 'kpiEvaluations/approveObjectiveEvaluationDept';
    } else if (status === ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL) {
        actionName = 'kpiEvaluations/approveObjectiveEvaluationManager';
    } else {
        notification.error({
            message: $t('error'),
            description: $t('invalidStatusForApproval', { status: getObjectiveEvaluationStatusText(status) }),
        });
        currentActionItemId.value = null;
        return;
    }

    try {
        await store.dispatch(actionName, { evaluationId: record.id });
        // fetchData will be called automatically by the action if successful (due to dispatch('fetchPendingObjectiveEvaluations') in store)
    } catch (error) {
        // Notification is handled by the Vuex action
        console.error(`Error during ${actionName}:`, error);
    } finally {
        currentActionItemId.value = null;
    }
};
const openRejectModal = (record) => { itemToReject.value = record; isRejectModalVisible.value = true; };
const handleReject = async () => {
    if (!itemToReject.value || !itemToReject.value.id) return;
    if (!rejectionReason.value || rejectionReason.value.trim() === '') {
        rejectError.value = $t('reasonRequired');
        return;
    }
    currentActionItemId.value = itemToReject.value.id;
    rejectError.value = null;

    let actionName = null;
    const status = itemToReject.value.status;

    if (status === ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL) {
        actionName = 'kpiEvaluations/rejectObjectiveEvaluationSection';
    } else if (status === ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL) {
        actionName = 'kpiEvaluations/rejectObjectiveEvaluationDept';
    } else if (status === ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL) {
        actionName = 'kpiEvaluations/rejectObjectiveEvaluationManager';
    } else {
        notification.error({ message: $t('error'), description: $t('invalidStatusForRejection', { status: getObjectiveEvaluationStatusText(status) }) });
        currentActionItemId.value = null;
        return;
    }

    try {
        await store.dispatch(actionName, { evaluationId: itemToReject.value.id, reason: rejectionReason.value });
        closeRejectModal(); // fetchData will be called by the action
    } catch (error) {
        rejectError.value = store.getters['kpiEvaluations/getObjectiveEvalApprovalError'] || $t('errorDuringRejection');
    } finally {
        if (!rejectError.value) { // Only reset if no error, otherwise keep modal open with error
            currentActionItemId.value = null;
        }
    }
};

const closeRejectModal = () => { isRejectModalVisible.value = false; };
const resetRejectModalState = () => { itemToReject.value = null; rejectionReason.value = ''; rejectError.value = null; };
const openDetailModal = async (record) => {
    if (!record || !record.id) return;
    selectedEvaluation.value = record;
    isDetailModalVisible.value = true;
    isLoadingHistory.value = true;
    historyError.value = null;
    try {
        const historyData = await store.dispatch('kpiEvaluations/fetchObjectiveEvaluationHistory', { evaluationId: record.id });
        evaluationHistory.value = historyData || [];
    } catch (error) {
        historyError.value = store.getters['kpiEvaluations/getObjectiveEvaluationHistoryError'] || $t('errorLoadingHistory');
        evaluationHistory.value = [];
    } finally {
        isLoadingHistory.value = false;
    }
};
const closeDetailModal = () => { isDetailModalVisible.value = false; };
const resetDetailModalState = () => { selectedEvaluation.value = null; evaluationHistory.value = []; isLoadingHistory.value = false; historyError.value = null; };

onMounted(() => {
    fetchData();
});

</script>

<style scoped>
.performance-objective-approval-list-page {
  padding: 24px;
}
</style>