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


// This view is deprecated: all legacy approval/rejection/history logic and UI have been removed.


</script>

<style scoped>
.performance-objective-approval-list-page {
  padding: 24px;
}
</style>