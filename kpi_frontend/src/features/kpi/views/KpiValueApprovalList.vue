<template>
  <div class="kpi-value-approval-list">
    <a-card class="modern-card">
      <template #title>
        <div class="page-header">
          <trophy-outlined class="page-icon" />
          <span class="page-title">{{ $t("kpiValueApprovalManagement") }}</span>
        </div>
      </template>

      <!-- Loading State -->
      <a-spin v-if="loading" :tip="$t('loading')" size="large" />

      <!-- No Permission State -->
      <a-result
        v-else-if="!hasAnyApprovalPermission"
        status="403"
        :title="$t('noPermission')"
        :sub-title="$t('noApprovalPermission')"
      />

      <!-- Error State -->
      <a-alert
        v-else-if="error"
        type="error"
        show-icon
        :message="$t('errorLoadingApprovalList')"
        :description="error"
        closable
        @close="clearError"
        style="margin-bottom: 16px"
      />

      <!-- Table Content -->
      <div v-else-if="pendingApprovals.length > 0" class="table-container">
        <a-table
          :columns="columns"
          :data-source="pendingApprovals"
          row-key="id"
          :pagination="pagination"
          bordered
          class="modern-table"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <!-- KPI Name Column -->
            <template v-if="column.key === 'kpiName'">
              <a-tooltip :title="record.kpiAssignment?.kpi?.name">
                <span>
                  <trophy-two-tone
                    style="font-size: 1em; margin-right: 4px; color: #409eff"
                  />
                  {{ record.kpiAssignment?.kpi?.name || $t("unknownKpiName") }}
                </span>
              </a-tooltip>
            </template>

            <!-- Employee Column -->
            <template v-else-if="column.key === 'employee'">
              <span>
                <user-outlined style="margin-right: 4px; color: #b37feb" />
                {{ record.kpiAssignment?.employee?.first_name || "" }}
                {{ record.kpiAssignment?.employee?.last_name || "" }}
                ({{ record.kpiAssignment?.employee?.username || "" }})
              </span>
            </template>

            <!-- Submitted Value Column -->
            <template v-else-if="column.key === 'value'">
              <div class="value-cell">
                <bar-chart-outlined class="value-icon" />
                <span class="value-text">
                  {{ record.value?.toLocaleString() ?? "" }}
                  <span v-if="record.kpiAssignment?.kpi?.unit">
                    {{ record.kpiAssignment.kpi.unit }}
                  </span>
                </span>
              </div>
            </template>

            <!-- Target Column -->
            <template v-else-if="column.key === 'target'">
              <div class="target-cell">
                <flag-outlined class="target-icon" />
                <span
                  v-if="
                    record.kpiAssignment?.targetValue !== null &&
                    record.kpiAssignment?.targetValue !== undefined
                  "
                  class="target-text"
                >
                  {{
                    Number(record.kpiAssignment.targetValue)?.toLocaleString()
                  }}
                  <span v-if="record.kpiAssignment?.kpi?.unit">
                    {{ record.kpiAssignment.kpi.unit }}
                  </span>
                </span>
              </div>
            </template>

            <!-- Submission Date Column -->
            <template v-else-if="column.key === 'submittedAt'">
              <div class="date-cell">
                <clock-circle-outlined class="date-icon" />
                <span class="date-text">{{
                  formatDate(
                    record.timestamp || record.updated_at || record.created_at
                  )
                }}</span>
              </div>
            </template>

            <!-- Notes Column -->
            <template v-else-if="column.key === 'notes'">
              <div class="notes-cell">
                <file-text-outlined class="notes-icon" />
                <span class="notes-text">{{ record.notes || "-" }}</span>
              </div>
            </template>

            <!-- Status Column -->
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)" class="status-tag">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <!-- Actions Column -->
            <template v-else-if="column.key === 'actions'">
              <div class="actions-cell">
                <a-space>
                  <!-- Details Button -->
                  <a-tooltip :title="$t('details')">
                    <a-button
                      type="primary"
                      size="small"
                      @click="viewDetails(record)"
                      class="action-btn"
                    >
                      <eye-outlined />
                      {{ $t("details") }}
                    </a-button>
                  </a-tooltip>

                  <!-- Approve Button -->
                  <a-tooltip
                    v-if="canApproveRecord(record)"
                    :title="$t('common.approve')"
                  >
                    <a-button
                      type="primary"
                      size="small"
                      @click="handleApprove(record)"
                      :loading="
                        loading &&
                        currentAction === 'approve' &&
                        currentRecordId === record.id
                      "
                      class="action-btn approve-btn"
                    >
                      <check-outlined />
                      {{ $t("common.approve") }}
                    </a-button>
                  </a-tooltip>

                  <!-- Reject Button -->
                  <a-tooltip
                    v-if="canRejectRecord(record)"
                    :title="$t('common.reject')"
                  >
                    <a-button
                      danger
                      size="small"
                      @click="handleReject(record)"
                      :disabled="isProcessing"
                      class="action-btn reject-btn"
                    >
                      <close-outlined />
                      {{ $t("common.reject") }}
                    </a-button>
                  </a-tooltip>
                </a-space>
              </div>
            </template>
          </template>
        </a-table>
      </div>

      <!-- Empty State -->
      <a-empty
        v-else
        :description="$t('noPendingApprovals')"
        class="empty-state"
      />
    </a-card>

    <!-- Reject Modal -->
    <a-modal
      :open="rejectModalVisible"
      :title="$t('rejectKpiValue')"
      @ok="confirmReject"
      @cancel="cancelReject"
      :confirm-loading="rejectLoading"
      :ok-text="$t('confirmReject')"
      :cancel-text="$t('cancel')"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('rejectionReason')" required>
          <a-textarea
            v-model:value="rejectReason"
            :placeholder="$t('enterRejectionReason')"
            :rows="4"
            :maxlength="500"
            show-count
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Details Modal -->
    <a-modal
      :open="detailsModalVisible"
      :title="$t('detailsAndHistory')"
      @cancel="closeDetailsModal"
      :footer="null"
      :width="1000"
      destroyOnClose
    >
      <a-spin :spinning="!selectedRecord" :tip="$t('loadingDetails')">
        <div v-if="selectedRecord">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item :label="$t('kpiName')">
              {{ selectedRecord.kpiAssignment?.kpi?.name || "" }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('employee')">
              {{
                `${selectedRecord.kpiAssignment?.employee?.first_name || ""} ${selectedRecord.kpiAssignment?.employee?.last_name || ""}`
              }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('assignedTarget')">
              {{ selectedRecord.kpiAssignment?.targetValue?.toLocaleString() }}
              {{ selectedRecord.kpiAssignment?.kpi?.unit }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('unit')">
              {{ selectedRecord.kpiAssignment?.kpi?.unit || "" }}
            </a-descriptions-item>
          </a-descriptions>

          <a-descriptions
            :title="$t('currentSubmissionDetails')"
            bordered
            size="small"
            :column="1"
            style="margin-top: 16px"
          >
            <a-descriptions-item :label="$t('currentStatus')">
              <a-tag :color="getStatusColor(selectedRecord.status)">
                {{ getStatusText(selectedRecord.status) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('submittedValue')">
              {{ selectedRecord.value?.toLocaleString() ?? "" }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('submissionTime')">
              {{
                formatDate(
                  selectedRecord.timestamp || selectedRecord.updated_at
                )
              }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('notes')">
              {{ selectedRecord.notes || $t("noNotes") }}
            </a-descriptions-item>

            <a-descriptions-item :label="$t('projectOrTaskDetails')">
              <div
                v-if="
                  Array.isArray(selectedRecord.project_details) &&
                  selectedRecord.project_details.length > 0
                "
              >
                <a-table
                  :columns="projectDetailsColumns"
                  :data-source="selectedRecord.project_details"
                  :pagination="false"
                  size="small"
                  bordered
                  row-key="name"
                  style="max-width: 500px"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'value'">
                      {{ record.value?.toLocaleString() ?? "" }}
                    </template>
                  </template>
                </a-table>
              </div>
              <span v-else>{{ $t("noProjectDetails") }}</span>
            </a-descriptions-item>

            <a-descriptions-item
              :label="$t('rejectionReasonIfAny')"
              v-if="selectedRecord.rejection_reason"
            >
              <span style="color: red">{{
                selectedRecord.rejection_reason
              }}</span>
            </a-descriptions-item>
          </a-descriptions>

          <h3 style="margin-top: 20px; margin-bottom: 10px">
            {{ $t("updateApprovalHistory") }}
          </h3>
          <a-spin :spinning="isLoadingHistory" :tip="$t('loadingHistory')">
            <a-alert
              v-if="historyError"
              type="error"
              show-icon
              :message="historyError"
              style="margin-bottom: 10px"
            />
            <a-table
              v-if="!historyError && kpiValueHistory.length > 0"
              :columns="historyColumns"
              :data-source="kpiValueHistory"
              :row-key="'id'"
              size="small"
              bordered
              :pagination="{ pageSize: 5, size: 'small' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'timestamp'">
                  {{ formatDate(record.changed_at || record.timestamp) }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <span>{{ getActionText(record.action) }}</span>
                </template>
                <template v-else-if="column.key === 'value'">
                  {{ record.value?.toLocaleString() ?? "" }}
                </template>
                <template v-else-if="column.key === 'noteOrReason'">
                  <a-tooltip v-if="record.reason" :title="record.reason">
                    <span style="color: red">
                      {{ $t("reason") }}: {{ truncateText(record.reason, 70) }}
                    </span>
                  </a-tooltip>
                  <a-tooltip v-else-if="record.notes" :title="record.notes">
                    <span>{{ truncateText(record.notes, 70) }}</span>
                  </a-tooltip>
                  <span v-else style="color: #888">-</span>
                </template>
                <template v-else-if="column.key === 'changed_by'">
                  <span v-if="record.changedByUser">
                    {{ record.changedByUser.first_name }}
                    {{ record.changedByUser.last_name }}
                  </span>
                  <span v-else-if="record.changed_by">
                    ID: {{ record.changed_by }}
                  </span>
                  <span v-else></span>
                </template>
              </template>
            </a-table>
            <a-empty
              v-if="!historyError && kpiValueHistory.length === 0"
              :description="$t('noHistory')"
            />
          </a-spin>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import {
  TrophyOutlined,
  TrophyTwoTone,
  UserOutlined,
  BarChartOutlined,
  FlagOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons-vue";
import {
  KpiValueStatus,
  getKpiValueStatusText,
  KpiValueStatusColor,
} from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import dayjs from "dayjs";

const store = useStore();
const { t } = useI18n();
const route = useRoute();

// Reactive data
const rejectModalVisible = ref(false);
const detailsModalVisible = ref(false);
const selectedRecord = ref(null);
const rejectReason = ref("");
const rejectLoading = ref(false);
const currentAction = ref("");
const currentRecordId = ref(null);

// History modal data
const kpiValueHistory = ref([]);
const isLoadingHistory = ref(false);
const historyError = ref(null);

// Computed properties
const loading = computed(() => store.getters["loading/isLoading"]);
const error = computed(() => store.getters["kpiValues/getPendingError"]);
const pendingApprovals = computed(
  () => store.getters["kpiValues/getPendingApprovals"]
);
const currentUser = computed(() => store.getters["auth/user"]);
const userPermissions = computed(() => currentUser.value?.permissions || []);

// Permission checking function
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === resource &&
      (scope ? p.scope?.trim() === scope : true)
  );
}

// Permission checks
const canApproveSection = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, "section")
);
const canApproveDepartment = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, "department")
);
const canApproveManager = computed(() =>
  hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, "manager")
);
const canRejectSection = computed(() =>
  hasPermission(RBAC_ACTIONS.REJECT, RBAC_RESOURCES.KPI_VALUE, "section")
);
const canRejectDepartment = computed(() =>
  hasPermission(RBAC_ACTIONS.REJECT, RBAC_RESOURCES.KPI_VALUE, "department")
);
const canRejectManager = computed(() =>
  hasPermission(RBAC_ACTIONS.REJECT, RBAC_RESOURCES.KPI_VALUE, "manager")
);

// Check if user has any view or approval permissions
const hasAnyApprovalPermission = computed(() => {
  // Check view permissions
  const canViewSection = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI_VALUE,
    "section"
  );
  const canViewDepartment = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI_VALUE,
    "department"
  );
  const canViewManager = hasPermission(
    RBAC_ACTIONS.VIEW,
    RBAC_RESOURCES.KPI_VALUE,
    "manager"
  );

  // Check approve/reject permissions
  const hasApprovalPermissions =
    canApproveSection.value ||
    canApproveDepartment.value ||
    canApproveManager.value ||
    canRejectSection.value ||
    canRejectDepartment.value ||
    canRejectManager.value;

  // Check view permissions
  const hasViewPermissions =
    canViewSection || canViewDepartment || canViewManager;

  return hasApprovalPermissions || hasViewPermissions;
});

// Table columns configuration
const columns = computed(() => [
  {
    title: t("kpiName"),
    key: "kpiName",
    dataIndex: ["kpiAssignment", "kpi", "name"],
    width: 200,
    ellipsis: true,
  },
  {
    title: t("employee"),
    key: "employee",
    dataIndex: "employee",
    width: 150,
    ellipsis: true,
  },
  {
    title: t("submittedValue"),
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 120,
  },
  {
    title: t("target"),
    dataIndex: ["kpiAssignment", "targetValue"],
    key: "target",
    align: "right",
    width: 120,
  },
  {
    title: t("submissionDate"),
    dataIndex: "timestamp",
    key: "submittedAt",
    width: 140,
  },
  {
    title: t("notes"),
    dataIndex: "notes",
    key: "notes",
    width: 150,
    ellipsis: true,
  },
  {
    title: t("status"),
    dataIndex: "status",
    key: "status",
    width: 180,
    align: "center",
  },
  {
    title: t("actions"),
    key: "actions",
    align: "center",
    width: 180,
    fixed: "right",
  },
]);

// Pagination configuration
const pagination = computed(() => ({
  pageSize: 10,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total, range) =>
    t("showingResults", { start: range[0], end: range[1], total }),
  pageSizeOptions: ["10", "20", "50", "100"],
}));

// Project details table columns
const projectDetailsColumns = computed(() => [
  {
    title: t("projectOrTaskName"),
    dataIndex: "name",
    key: "name",
  },
  {
    title: t("value"),
    dataIndex: "value",
    key: "value",
    align: "right",
  },
]);

// History table columns
const historyColumns = computed(() => [
  {
    title: t("timestamp"),
    dataIndex: "timestamp",
    key: "timestamp",
    width: 160,
  },
  {
    title: t("action"),
    dataIndex: "action",
    key: "action",
    width: 120,
  },
  {
    title: t("value"),
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 100,
  },
  {
    title: t("notesOrReason"),
    dataIndex: "noteOrReason",
    key: "noteOrReason",
    ellipsis: true,
  },
  {
    title: t("changedBy"),
    dataIndex: "changed_by",
    key: "changed_by",
    width: 150,
  },
]);

// Helper functions

const formatDate = (dateString) => {
  if (!dateString) return "-";
  return dayjs(dateString).format("YYYY-MM-DD");
};

const getStatusColor = (status) => {
  return KpiValueStatusColor[status] || "default";
};

const getStatusText = (status) => {
  const statusTextMap = getKpiValueStatusText(t);
  return statusTextMap[status] || status || t("unknown");
};

// Permission helper functions
const canApproveRecord = (record) => {
  switch (record.status) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      return canApproveSection.value;
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      return canApproveDepartment.value;
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      return canApproveManager.value;
    default:
      return false;
  }
};

const canRejectRecord = (record) => {
  switch (record.status) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      return canRejectSection.value;
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      return canRejectDepartment.value;
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      return canRejectManager.value;
    default:
      return false;
  }
};

// Helper functions for modal
const getActionText = (actionKey) => {
  const actionMap = {
    SUBMIT_CREATE: t("createAndSubmit"),
    SUBMIT_UPDATE: t("updateAndSubmit"),
    APPROVE_SECTION: t("sectionApprove"),
    REJECT_SECTION: t("sectionReject"),
    APPROVE_DEPT: t("deptApprove"),
    REJECT_DEPT: t("deptReject"),
    APPROVE_MANAGER: t("managerApprove"),
    REJECT_MANAGER: t("managerReject"),
    CREATE: t("create"),
    UPDATE: t("update"),
    DELETE: t("delete"),
  };
  return actionMap[actionKey?.toUpperCase()] || actionKey || t("unknown");
};

const truncateText = (text, length) =>
  text?.length > length ? `${text.substring(0, length)}...` : text || "";

// Action handlers
const viewDetails = async (record) => {
  selectedRecord.value = record;
  detailsModalVisible.value = true;

  // Load history when modal opens
  if (record.id) {
    await loadHistory(record.id);
  }
};

const loadHistory = async (valueId) => {
  isLoadingHistory.value = true;
  historyError.value = null;
  try {
    const history = await store.dispatch("kpiValues/fetchValueHistory", {
      valueId,
    });
    kpiValueHistory.value = history || [];
  } catch (error) {
    historyError.value =
      error.response?.data?.message ||
      error.message ||
      t("errorLoadingHistory");
    kpiValueHistory.value = [];
  } finally {
    isLoadingHistory.value = false;
  }
};

const closeDetailsModal = () => {
  detailsModalVisible.value = false;
  selectedRecord.value = null;
  kpiValueHistory.value = [];
  historyError.value = null;
};

const handleApprove = async (record) => {
  currentAction.value = "approve";
  currentRecordId.value = record.id;

  try {
    const action = getApprovalAction(record.status);
    if (action) {
      await store.dispatch(`kpiValues/${action}`, { valueId: record.id });
    }
  } catch (error) {
    // Handle approval error silently
  } finally {
    currentAction.value = "";
    currentRecordId.value = null;
  }
};

const handleReject = (record) => {
  selectedRecord.value = record;
  rejectReason.value = "";
  rejectModalVisible.value = true;
};

const confirmReject = async () => {
  if (!rejectReason.value.trim()) {
    return;
  }

  rejectLoading.value = true;
  currentAction.value = "reject";
  currentRecordId.value = selectedRecord.value.id;

  try {
    const action = getRejectionAction(selectedRecord.value.status);
    if (action) {
      await store.dispatch(`kpiValues/${action}`, {
        valueId: selectedRecord.value.id,
        reason: rejectReason.value.trim(),
      });
    }
    rejectModalVisible.value = false;
    selectedRecord.value = null;
    rejectReason.value = "";
  } catch (error) {
    // Handle rejection error silently
  } finally {
    rejectLoading.value = false;
    currentAction.value = "";
    currentRecordId.value = null;
  }
};

const cancelReject = () => {
  rejectModalVisible.value = false;
  selectedRecord.value = null;
  rejectReason.value = "";
};

const getApprovalAction = (status) => {
  switch (status) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      return "approveValueSection";
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      return "approveValueDept";
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      return "approveValueManager";
    default:
      return null;
  }
};

const getRejectionAction = (status) => {
  switch (status) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      return "rejectValueSection";
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      return "rejectValueDept";
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      return "rejectValueManager";
    default:
      return null;
  }
};

const clearError = () => {
  store.commit("kpiValues/SET_PENDING_ERROR", null);
};

// Lifecycle hooks
onMounted(async () => {
  try {
    await store.dispatch("kpiValues/fetchPendingApprovals");

    // Check for highlighted item from query params
    await nextTick();
    if (route.query.highlightKpiValueId) {
      // You can implement highlighting logic here if needed
    }
  } catch (error) {
    // Handle loading error silently
  }
});
</script>

<style scoped>
.kpi-value-approval-list {
  background-color: #f5f5f5;
  min-height: auto;
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
  font-size: 20px;
  font-weight: 600;
  color: #262626;
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

.kpi-type-cell,
.employee-cell,
.value-cell,
.target-cell,
.date-cell,
.notes-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kpi-icon,
.employee-icon,
.value-icon,
.target-icon,
.date-icon,
.notes-icon {
  color: #1890ff;
  font-size: 16px;
}

.value-icon {
  color: #faad14;
}

.target-icon {
  color: #1890ff;
}

.date-icon {
  color: #1890ff;
}

.notes-icon {
  color: #1890ff;
}

.status-tag {
  font-weight: 500;
  border-radius: 6px;
}

.actions-cell {
  display: flex;
  justify-content: center;
}

.action-btn {
  border-radius: 6px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.approve-btn {
  background-color: #52c41a;
  border-color: #52c41a;
}

.approve-btn:hover {
  background-color: #73d13d;
  border-color: #73d13d;
}

.reject-btn {
  background-color: #ff4d4f;
  border-color: #ff4d4f;
  color: #fff !important;
}

.reject-btn:hover {
  background-color: #ff7875;
  border-color: #ff7875;
  color: #fff !important;
}

.reject-btn:focus {
  color: #fff !important;
}

.reject-btn .ant-btn-loading-icon {
  margin-right: 4px;
}

.reject-btn.ant-btn-loading {
  color: #fff !important;
}

.empty-state {
  padding: 48px 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .kpi-value-approval-list {
    padding: 16px;
  }

  .page-title {
    font-size: 18px;
  }

  .modern-table :deep(.ant-table-tbody > tr > td) {
    padding: 8px;
    font-size: 14px;
  }
}
</style>
