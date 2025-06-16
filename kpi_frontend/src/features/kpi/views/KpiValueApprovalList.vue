<template>
  <div class="kpi-value-approval-list-page">
    <a-card :title="cardTitleWithIcon" :bordered="false">
      <a-spin :spinning="isLoadingPending" :tip="$t('loadingList')">
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
          v-if="!loadingError && pendingItems.length > 0"
          :columns="columns"
          :data-source="pendingItems"
          :row-key="'id'"
          bordered
          size="small"
          :scroll="{ x: 'max-content' }"
          class="modern-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'kpiName'">
              <a-tooltip :title="record.kpiAssignment?.kpi?.name">
                <span>
                  <trophy-two-tone style="font-size: 1em; margin-right: 4px; color: #409eff;" />
                  {{ record.kpiAssignment?.kpi?.name || $t('unknownKpiName') }}
                </span>
              </a-tooltip>
            </template>

            <template v-else-if="column.key === 'employee'">
              <span>
                <user-outlined style="margin-right: 4px; color: #b37feb;" />
                {{ record.kpiAssignment?.employee?.first_name || '' }}
                {{ record.kpiAssignment?.employee?.last_name || '' }}
                ({{ record.kpiAssignment?.employee?.username || '' }})
              </span>
            </template>

            <template v-else-if="column.key === 'value'">
              <span>
                <calculator-outlined style="margin-right: 4px; color: #faad14;" />
                {{ record.value?.toLocaleString() ?? '' }}
                <span v-if="record.kpiAssignment?.kpi?.unit">
                  {{ record.kpiAssignment.kpi.unit }}
                </span>
              </span>
            </template>

            <template v-else-if="column.key === 'target'">
              <span v-if="record.kpiAssignment?.targetValue !== null && record.kpiAssignment?.targetValue !== undefined">
                <flag-two-tone style="margin-right: 4px; color: #52c41a;" />
                {{ Number(record.kpiAssignment.targetValue)?.toLocaleString() }}
                <span v-if="record.kpiAssignment?.kpi?.unit">
                  {{ record.kpiAssignment.kpi.unit }}
                </span>
              </span>
              <span v-else></span>
            </template>

            <template v-else-if="column.key === 'submittedAt'">
              <clock-circle-two-tone style="margin-right: 4px; color: #1890ff;" />
              {{ formatDate(record.timestamp || record.updated_at || record.created_at) }}
            </template>

            <template v-else-if="column.key === 'notes'">
              <a-tooltip :title="record.notes">
                <file-text-outlined style="margin-right: 4px; color: #13c2c2;" />
                <span>{{ truncateText(record.notes, 50) }}</span>
              </a-tooltip>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag :color="getValueStatusColor(record.status)" class="status-tag">
                <component :is="statusIcon(record.status)" style="margin-right: 6px; font-size: 1.1em; vertical-align: middle;" />
                {{ getValueStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="openDetailModal(record)"
                  :title="$t('viewDetailsAndHistory')"
                  class="icon-btn"
                >
                  <eye-outlined /> {{ $t('details') }}
                </a-button>
                <a-button
                  type="primary"
                  size="small"
                  @click="handleApprove(record.id)"
                  :loading="isProcessing && currentActionItemId === record.id"
                  :disabled="isProcessing && currentActionItemId !== record.id"
                  :title="$t('approve')"
                  v-if="canApproveKpiValue"
                  class="icon-btn"
                >
                  <check-circle-two-tone two-tone-color="#52c41a" /> {{ $t('approve') }}
                </a-button>
                <a-button
                  danger
                  size="small"
                  @click="openRejectModal(record)"
                  :disabled="isProcessing"
                  :title="$t('reject')"
                  v-if="canRejectKpiValue"
                  class="icon-btn"
                >
                  <close-circle-two-tone two-tone-color="#ff4d4f" /> {{ $t('reject') }}
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>

        <a-empty
          v-if="!loadingError && pendingItems.length === 0"
          :description="$t('noPendingItems')"
        >
          <template #image>
            <frown-two-tone style="font-size: 3em; color: #bfbfbf;" />
          </template>
        </a-empty>
      </a-spin>
    </a-card>

    <a-modal
      :open="isRejectModalVisible"
      :title="$t('rejectReason')"
      @ok="handleReject"
      @cancel="closeRejectModal"
      :confirm-loading="
        isProcessing && currentActionItemId === itemToReject?.id
      "
      :ok-text="$t('confirmReject')"
      :cancel-text="$t('cancel')"
      :maskClosable="false"
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
          $t("rejectValueForKpi", {
            value: itemToReject.value?.toLocaleString(),
            kpiName: itemToReject.kpiAssignment?.kpi?.name,
            employeeName: `${itemToReject.kpiAssignment?.employee?.first_name} ${itemToReject.kpiAssignment?.employee?.last_name}`,
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

    <a-modal
      :open="isDetailModalVisible"
      :title="$t('detailsAndHistory')"
      @cancel="closeDetailModal"
      :width="1000"
      :footer="null"
      destroyOnClose
      @afterClose="resetDetailModalState"
    >
      <a-spin :spinning="!selectedKpiValue" :tip="$t('loadingDetails')">
        <div v-if="selectedKpiValue">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item :label="$t('kpiName')">{{
              selectedKpiValue.kpiAssignment?.kpi?.name || ""
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('employee')">{{
              `${selectedKpiValue.kpiAssignment?.employee?.first_name || ""}
              ${selectedKpiValue.kpiAssignment?.employee?.last_name || ""}`
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('assignedTarget')"
              >{{
                selectedKpiValue.kpiAssignment?.targetValue?.toLocaleString()
              }}
              {{
                selectedKpiValue.kpiAssignment?.kpi?.unit
              }}</a-descriptions-item
            >
            <a-descriptions-item :label="$t('unit')">{{
              selectedKpiValue.kpiAssignment?.kpi?.unit || ""
            }}</a-descriptions-item>
          </a-descriptions>

          <a-descriptions
            :title="$t('currentSubmissionDetails')"
            bordered
            size="small"
            :column="1"
            style="margin-top: 16px"
          >
            <a-descriptions-item :label="$t('currentStatus')">
              <a-tag :color="getValueStatusColor(selectedKpiValue.status)">
                {{ getValueStatusText(selectedKpiValue.status) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('submittedValue')">{{
              selectedKpiValue.value?.toLocaleString() ?? ""
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('submissionTime')">{{
              formatDate(
                selectedKpiValue.timestamp || selectedKpiValue.updated_at
              )
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('notes')">{{
              selectedKpiValue.notes || $t("noNotes")
            }}</a-descriptions-item>

            <a-descriptions-item :label="$t('projectOrTaskDetails')">
              <div
                v-if="
                  Array.isArray(selectedKpiValue.project_details) &&
                  selectedKpiValue.project_details.length > 0
                "
              >
                <a-table
                  :columns="projectDetailsColumns"
                  :data-source="selectedKpiValue.project_details"
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
              v-if="selectedKpiValue.rejection_reason"
            >
              <span style="color: red">{{
                selectedKpiValue.rejection_reason
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
                    <span style="color: red"
                      >{{ $t("reason") }}:
                      {{ truncateText(record.reason, 70) }}</span
                    >
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
// Vue core imports
import { ref, computed, onMounted, h } from "vue";
// Vuex store
import { useStore } from "vuex";
// Ant Design Vue components and icons
import {
  Table as ATable,
  Button as AButton,
  Space as ASpace,
  Modal as AModal,
  Textarea as ATextarea,
  FormItem as AFormItem,
  Card as ACard,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  Tag as ATag,
  Tooltip as ATooltip,
  notification,
} from "ant-design-vue";
import {
  TrophyTwoTone,
  UserOutlined,
  CalculatorOutlined,
  FlagTwoTone,
  ClockCircleTwoTone,
  FileTextOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  EyeOutlined,
  FrownTwoTone,
  SmileTwoTone,
  ExclamationCircleTwoTone,
  SyncOutlined,
} from "@ant-design/icons-vue";
// Utilities
import dayjs from "dayjs";
// Constants
import {
  KpiValueStatus,
  KpiValueStatusColor,
} from "@/core/constants/kpiStatus";
import { getKpiValueStatusText } from "@/core/constants/kpiStatus";
import { useI18n } from "vue-i18n";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const { t: $t } = useI18n();
const KpiValueStatusText = getKpiValueStatusText($t);

console.log("KpiValueStatus:", KpiValueStatus);

// Store instance
const store = useStore();

// Reactive state variables
const pendingItems = ref([]);
const isLoadingPending = ref(false);
const loadingError = ref(null);
const isRejectModalVisible = ref(false);
const itemToReject = ref(null);
const rejectionReason = ref("");
const rejectError = ref(null);
const currentActionItemId = ref(null);
const isDetailModalVisible = ref(false);
const selectedKpiValue = ref(null);
const kpiValueHistory = ref([]);
const isLoadingHistory = ref(false);
const historyError = ref(null);

// Computed properties
const isProcessing = computed(
  () => store.getters["kpiValues/isProcessingApproval"]
);
const currentUser = computed(() => store.getters["auth/user"]);
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);

// Computed card title based on user role
const cardTitle = computed(() => {
  const role = effectiveRole.value;
  if (role === "admin") return $t("adminApprovalTitle");
  if (role === "manager") return $t("managerApprovalTitle");
  if (role === "leader") return $t("leaderApprovalTitle");
  return $t("defaultApprovalTitle");
});

// Card title with icon
const cardTitleWithIcon = computed(() =>
  h(
    'span',
    { style: 'display: flex; align-items: center; gap: 8px;' },
    [
      h(TrophyTwoTone, { style: 'font-size: 1.4em; color: #409eff; marginRight: "6px"' }),
      cardTitle.value
    ]
  )
);

// Permission-related computed properties
const userPermissions = computed(() => currentUser.value?.permissions || []);
function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action === action &&
      p.resource === resource &&
      (scope ? p.scope === scope : true)
  );
}
const canApproveKpiValue = computed(
  () =>
    ['section', 'department', 'manager'].some(scope =>
      hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE, scope)
    )
);
const canRejectKpiValue = computed(
  () =>
    ['section', 'department', 'manager'].some(scope =>
      hasPermission(RBAC_ACTIONS.REJECT, RBAC_RESOURCES.KPI_VALUE, scope)
    )
);

// Table columns definitions extracted outside component logic
const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: ["kpiAssignment", "kpi", "name"],
    key: "kpiName",
    width: 200,
    ellipsis: true,
  },
  { title: $t("employee"), key: "employee", width: 150, ellipsis: true },
  {
    title: $t("submittedValue"),
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 120,
  },
  {
    title: $t("target"),
    dataIndex: ["kpiAssignment", "targetValue"],
    key: "target",
    align: "right",
    width: 120,
  },
  {
    title: $t("submissionDate"),
    dataIndex: "timestamp",
    key: "submittedAt",
    width: 140,
  },
  {
    title: $t("notes"),
    dataIndex: "notes",
    key: "notes",
    width: 150,
    ellipsis: true,
  },
  {
    title: $t("status"),
    dataIndex: "status",
    key: "status",
    width: 180,
    align: "center",
  },
  {
    title: $t("actions"),
    key: "actions",
    align: "center",
    width: 180,
    fixed: "right",
  },
]);

const historyColumns = computed(() => [
  { title: $t("timestamp"), key: "timestamp", width: 140 },
  { title: $t("common.actions"), dataIndex: "action", key: "action", width: 180 },
  {
    title: $t("value"),
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 100,
  },
  { title: $t("noteOrReason"), key: "noteOrReason", ellipsis: true },
  { title: $t("changedBy"), key: "changed_by", width: 150 },
]);

const projectDetailsColumns = computed(() => [
  {
    title: $t("projectOrTaskName"),
    dataIndex: "name",
    key: "name",
    ellipsis: true,
  },
  {
    title: $t("value"),
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 100,
  },
]);

// Utility functions with comments
const getActionText = (actionKey) => {
  const map = {
    SUBMIT_CREATE: $t("submitCreate"),
    SUBMIT_UPDATE: $t("submitUpdate"),
    APPROVE_SECTION: $t("approveSection"),
    REJECT_SECTION: $t("rejectSection"),
    APPROVE_DEPT: $t("approveDept"),
    REJECT_DEPT: $t("rejectDept"),
    APPROVE_MANAGER: $t("approveManager"),
    REJECT_MANAGER: $t("rejectManager"),
    CREATE: $t("create"),
    UPDATE: $t("update"),
    DELETE: $t("delete"),
  };
  return map[actionKey?.toUpperCase()] || actionKey || $t("unknown");
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return dayjs(dateString).format("YYYY-MM-DD HH:mm");
};

const truncateText = (text, length) => {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

const getValueStatusText = (status) => {
  console.log("getValueStatusText called with status:", status);
  return KpiValueStatusText[status] || status || "Không xác định";
};

const getValueStatusColor = (status) => {
  return KpiValueStatusColor[status] || "default";
};

// Status icon mapping
const statusIcon = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'pending_section_approval':
      return SyncOutlined;
    case 'pending_dept_approval':
      return SyncOutlined;
    case 'pending_manager_approval':
      return SyncOutlined;
    case 'approved':
      return SmileTwoTone;
    case 'rejected':
      return ExclamationCircleTwoTone;
    default:
      return ExclamationCircleTwoTone;
  }
};

// Fetch pending KPI approval items
const fetchData = async () => {
  if (!currentUser.value || !currentUser.value.id) {
    loadingError.value = "Không thể xác định người dùng.";
    return;
  }

  isLoadingPending.value = true;
  loadingError.value = null;
  const fetchAction = "kpiValues/fetchPendingApprovals";

  try {
    const data = await store.dispatch(fetchAction);
    pendingItems.value = data || [];
    console.log("Fetched pending items: ", pendingItems.value);
  } catch (error) {
    loadingError.value =
      store.getters["kpiValues/getPendingError"] ||
      "Lỗi khi tải danh sách chờ duyệt.";
    pendingItems.value = [];
    console.error("Fetch pending error:", error);
  } finally {
    isLoadingPending.value = false;
  }
};

// Handle approval action
const handleApprove = async (valueId) => {
  if (!valueId) return;
  const item = pendingItems.value.find((p) => p.id === valueId);
  if (!item) return;

  currentActionItemId.value = valueId;
  let actionName = null;
  console.log(`Item Status to Approve: ${item.status}`);

  if (!KpiValueStatus.PENDING_DEPT_APPROVAL) {
    console.error("KpiValueStatus.PENDING_DEPT_APPROVAL is undefined");
    return;
  }

  switch (item.status) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      actionName = "kpiValues/approveValueSection";
      break;
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      actionName = "kpiValues/approveValueDept";
      break;
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      actionName = "kpiValues/approveValueManager";
      break;
    default:
      notification.error({
        message: "Lỗi",
        description: `Trạng thái '${item.status}' không hợp lệ để phê duyệt.`,
      });
      currentActionItemId.value = null;
      return;
  }
  console.log(`Dispatching Vuex Action: ${actionName} for valueId: ${valueId}`);
  try {
    await store.dispatch(actionName, { valueId });
    await fetchData();
  } catch (error) {
    console.error(`Lỗi khi thực hiện ${actionName}:`, error);
  } finally {
    currentActionItemId.value = null;
  }
};

// Open reject modal with validation
const openRejectModal = (item) => {
  if (!item || item.id === undefined) return;

  if (
    ![
      KpiValueStatus.PENDING_SECTION_APPROVAL,
      KpiValueStatus.PENDING_DEPT_APPROVAL,
      KpiValueStatus.PENDING_MANAGER_APPROVAL,
    ].includes(item.status)
  ) {
    notification.warn({
      message: "Trạng thái không hợp lệ",
      description: "Không thể từ chối mục ở trạng thái này.",
    });
    return;
  }
  itemToReject.value = item;
  // Reset modal state for new instance
  rejectionReason.value = "";
  rejectError.value = null;
  isRejectModalVisible.value = true;
};
// Close reject modal and reset state after delay
const closeRejectModal = () => {
  isRejectModalVisible.value = false;

  setTimeout(() => {
    itemToReject.value = null;
    rejectionReason.value = "";
    rejectError.value = null;
    currentActionItemId.value = null;
  }, 300);
};
// Reset reject modal state immediately
const resetRejectModalState = () => {
  itemToReject.value = null;
  rejectionReason.value = "";
  rejectError.value = null;
  currentActionItemId.value = null;
};

// Handle reject action with validation and Vuex dispatch
const handleReject = async () => {
  if (!rejectionReason.value || rejectionReason.value.trim() === "") {
    rejectError.value = "Vui lòng nhập lý do từ chối.";
    return;
  }
  if (!itemToReject.value) return;

  const valueId = itemToReject.value.id;
  const currentStatus = itemToReject.value.status;
  currentActionItemId.value = valueId;
  rejectError.value = null;

  let actionName = null;

  switch (currentStatus) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      actionName = "kpiValues/rejectValueSection";
      break;
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      actionName = "kpiValues/rejectValueDept";
      break;
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      actionName = "kpiValues/rejectValueManager";
      break;
    default:
      notification.error({
        message: "Lỗi",
        description: `Trạng thái '${currentStatus}' không hợp lệ để từ chối.`,
      });
      currentActionItemId.value = null;

      rejectError.value = `Trạng thái '${currentStatus}' không hợp lệ để từ chối.`;
      return;
  }

  try {
    await store.dispatch(actionName, {
      valueId,
      reason: rejectionReason.value,
    });
    closeRejectModal();
    await fetchData();
  } catch (error) {
    rejectError.value =
      store.getters["kpiValues/getApprovalError"] ||
      "Lỗi khi thực hiện từ chối.";
    console.error(`Lỗi khi thực hiện ${actionName}:`, error);
  } finally {
    if (!rejectError.value) {
      currentActionItemId.value = null;
    }
  }
};

// Open detail modal and load history
const openDetailModal = async (record) => {
  if (!record || !record.id) return;
  selectedKpiValue.value = record;
  isDetailModalVisible.value = true;
  await loadHistory(record.id);
};

// Load KPI value history from store
const loadHistory = async (valueId) => {
  if (!valueId) return;
  isLoadingHistory.value = true;
  historyError.value = null;
  kpiValueHistory.value = [];
  try {
    const historyData = await store.dispatch("kpiValues/fetchValueHistory", {
      valueId,
    });
    kpiValueHistory.value = historyData || [];
    console.log("Fetched history: ", kpiValueHistory.value);
  } catch (error) {
    historyError.value = error.message || "Lỗi khi tải lịch sử.";
    console.error("Fetch history error:", error);
  } finally {
    isLoadingHistory.value = false;
  }
};

// Close detail modal
const closeDetailModal = () => {
  isDetailModalVisible.value = false;
};
// Reset detail modal state
const resetDetailModalState = () => {
  selectedKpiValue.value = null;
  kpiValueHistory.value = [];
  isLoadingHistory.value = false;
  historyError.value = null;
};

// Fetch data on component mount
onMounted(() => {
  if (currentUser.value && currentUser.value.id) {
    fetchData();
  } else {
    loadingError.value =
      "Không thể xác định thông tin người dùng để tải dữ liệu.";
  }
});
</script>

<style scoped>
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
.modern-table {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px #e6f7ff33;
}
.ant-table-actions {
  text-align: center;
}
:deep(.ant-alert-error) {
  margin-bottom: 10px;
}
</style>
