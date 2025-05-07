<template>
  <div class="kpi-value-approval-list-page">
    <a-card :title="cardTitle" :bordered="false">
      <a-spin :spinning="isLoadingPending" tip="Đang tải danh sách...">
        <a-alert
          v-if="loadingError"
          type="error"
          show-icon
          closable
          style="margin-bottom: 16px"
          :message="loadingError"
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
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'kpiName'">
              <a-tooltip :title="record.kpiAssignment?.kpi?.name">
                <span>{{ record.kpiAssignment?.kpi?.name || "N/A" }}</span>
              </a-tooltip>
            </template>

            <template v-else-if="column.key === 'employee'">
              <span>
                {{ record.kpiAssignment?.employee?.first_name || "" }}
                {{ record.kpiAssignment?.employee?.last_name || "" }}
                ({{ record.kpiAssignment?.employee?.username || "N/A" }})
              </span>
            </template>

            <template v-else-if="column.key === 'value'">
              {{ record.value?.toLocaleString() ?? "N/A" }}
              <span v-if="record.kpiAssignment?.kpi?.unit">
                {{ record.kpiAssignment.kpi.unit }}</span
              >
            </template>

            <template v-else-if="column.key === 'target'">
              <span
                v-if="
                  record.kpiAssignment?.targetValue !== null &&
                  record.kpiAssignment?.targetValue !== undefined
                "
              >
                {{ record.kpiAssignment.targetValue?.toLocaleString() }}
                <span v-if="record.kpiAssignment?.kpi?.unit">
                  {{ record.kpiAssignment.kpi.unit }}</span
                >
              </span>
              <span v-else>N/A</span>
            </template>

            <template v-else-if="column.key === 'submittedAt'">
              {{
                formatDate(
                  record.timestamp || record.updated_at || record.created_at
                )
              }}
            </template>

            <template v-else-if="column.key === 'notes'">
              <a-tooltip :title="record.notes">
                <span>{{ truncateText(record.notes, 50) }}</span>
              </a-tooltip>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag :color="getValueStatusColor(record.status)">
                {{ getValueStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="openDetailModal(record)"
                  title="Xem Chi tiết & Lịch sử"
                >
                  <eye-outlined /> Chi tiết
                </a-button>
                <a-button
                  type="primary"
                  size="small"
                  @click="handleApprove(record.id)"
                  :loading="isProcessing && currentActionItemId === record.id"
                  :disabled="isProcessing && currentActionItemId !== record.id"
                  title="Phê duyệt"
                >
                  <check-outlined /> Approve
                </a-button>
                <a-button
                  danger
                  size="small"
                  @click="openRejectModal(record)"
                  :disabled="isProcessing"
                  title="Từ chối"
                >
                  <close-outlined /> Reject
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>

        <a-empty
          v-if="!loadingError && pendingItems.length === 0"
          description="Không có mục nào đang chờ duyệt."
        />
      </a-spin>
    </a-card>

    <a-modal
      :open="isRejectModalVisible"
      title="Lý do từ chối"
      @ok="handleReject"
      @cancel="closeRejectModal"
      :confirm-loading="
        isProcessing && currentActionItemId === itemToReject?.id
      "
      ok-text="Xác nhận Từ chối"
      cancel-text="Hủy"
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
        Từ chối giá trị
        <strong>{{ itemToReject.value?.toLocaleString() }}</strong> cho KPI
        <strong>"{{ itemToReject.kpiAssignment?.kpi?.name }}"</strong> của nhân
        viên
        <strong
          >{{ itemToReject.kpiAssignment?.employee?.first_name }}
          {{ itemToReject.kpiAssignment?.employee?.last_name }}</strong
        >?
      </p>
      <a-form-item
        label="Lý do (bắt buộc):"
        :validate-status="rejectError ? 'error' : ''"
        :help="rejectError"
      >
        <a-textarea
          v-model:value="rejectionReason"
          placeholder="Nhập lý do từ chối..."
          :rows="4"
        />
      </a-form-item>
    </a-modal>

    <a-modal
      :open="isDetailModalVisible"
      title="Chi tiết và Lịch sử Cập nhật KPI"
      @cancel="closeDetailModal"
      :width="1000"
      :footer="null"
      destroyOnClose
      @afterClose="resetDetailModalState"
    >
      <a-spin :spinning="!selectedKpiValue" tip="Đang tải chi tiết...">
        <div v-if="selectedKpiValue">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item label="Tên KPI">{{
              selectedKpiValue.kpiAssignment?.kpi?.name || ""
            }}</a-descriptions-item>
            <a-descriptions-item label="Nhân viên">{{
              `${selectedKpiValue.kpiAssignment?.employee?.first_name || ""}
              ${selectedKpiValue.kpiAssignment?.employee?.last_name || ""}`
            }}</a-descriptions-item>
            <a-descriptions-item label="Target Giao"
              >{{
                selectedKpiValue.kpiAssignment?.targetValue?.toLocaleString()
              }}
              {{
                selectedKpiValue.kpiAssignment?.kpi?.unit
              }}</a-descriptions-item
            >
            <a-descriptions-item label="Đơn vị Tính">{{
              selectedKpiValue.kpiAssignment?.kpi?.unit || ""
            }}</a-descriptions-item>
          </a-descriptions>

          <a-descriptions
            title="Chi tiết Lần Submit Hiện tại"
            bordered
            size="small"
            :column="1"
            style="margin-top: 16px"
          >
            <a-descriptions-item label="Trạng thái Hiện tại">
              <a-tag :color="getValueStatusColor(selectedKpiValue.status)">
                {{ getValueStatusText(selectedKpiValue.status) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="Giá trị Nộp">{{
              selectedKpiValue.value?.toLocaleString() ?? ""
            }}</a-descriptions-item>
            <a-descriptions-item label="Thời gian Nộp/Cập nhật">{{
              formatDate(
                selectedKpiValue.timestamp || selectedKpiValue.updated_at
              )
            }}</a-descriptions-item>
            <a-descriptions-item label="Ghi chú (Notes)">{{
              selectedKpiValue.notes || "Không có"
            }}</a-descriptions-item>

            <a-descriptions-item label="Chi tiết Dự án/Công việc">
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
                      {{ record.value?.toLocaleString() ?? "N/A" }}
                    </template>
                  </template>
                </a-table>
              </div>
              <span v-else>Không có chi tiết dự án/công việc.</span>
            </a-descriptions-item>

            <a-descriptions-item
              label="Lý do Từ chối (nếu có)"
              v-if="selectedKpiValue.rejection_reason"
            >
              <span style="color: red">{{
                selectedKpiValue.rejection_reason
              }}</span>
            </a-descriptions-item>
          </a-descriptions>

          <h3 style="margin-top: 20px; margin-bottom: 10px">
            Lịch sử Cập nhật/Phê duyệt
          </h3>
          <a-spin :spinning="isLoadingHistory" tip="Đang tải lịch sử...">
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
                      >Lý do: {{ truncateText(record.reason, 70) }}</span
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
                  <span v-else>N/A</span>
                </template>
              </template>
            </a-table>
            <a-empty
              v-if="!historyError && kpiValueHistory.length === 0"
              description="Không có lịch sử."
            />
          </a-spin>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
// Vue core imports
import { ref, computed, onMounted } from "vue";
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
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from "@ant-design/icons-vue";
// Utilities
import dayjs from "dayjs";
// Constants
import {
  KpiValueStatus,
  KpiValueStatusText,
  KpiValueStatusColor,
} from "@/core/constants/kpiStatus";

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

// Computed card title based on user role
const cardTitle = computed(() => {
  const role = currentUser.value?.role;
  if (role === "admin") return "Quản lý Phê duyệt Giá trị KPI (Admin)";
  if (role === "manager") return "Giá trị KPI chờ Manager/Department duyệt";
  if (role === "leader") return "Giá trị KPI chờ Section duyệt";
  return "Danh sách chờ duyệt";
});

// Table columns definitions extracted outside component logic
const columns = ref([
  {
    title: "Tên KPI",
    dataIndex: ["kpiAssignment", "kpi", "name"],
    key: "kpiName",
    width: 200,
    ellipsis: true,
  },
  { title: "Nhân viên", key: "employee", width: 150, ellipsis: true },
  {
    title: "Giá trị Nộp",
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 120,
  },
  {
    title: "Target",
    dataIndex: ["kpiAssignment", "targetValue"],
    key: "target",
    align: "right",
    width: 120,
  },
  {
    title: "Ngày Submit",
    dataIndex: "timestamp",
    key: "submittedAt",
    width: 140,
  },
  {
    title: "Ghi chú",
    dataIndex: "notes",
    key: "notes",
    width: 150,
    ellipsis: true,
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    width: 180,
    align: "center",
  },
  {
    title: "Hành động",
    key: "actions",
    align: "center",
    width: 180,
    fixed: "right",
  },
]);

const historyColumns = ref([
  { title: "Thời gian", key: "timestamp", width: 140 },
  { title: "Hành động", dataIndex: "action", key: "action", width: 180 },
  {
    title: "Giá trị",
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 100,
  },
  { title: "Ghi chú / Lý do", key: "noteOrReason", ellipsis: true },
  { title: "Người thực hiện", key: "changed_by", width: 150 },
]);

const projectDetailsColumns = ref([
  {
    title: "Tên Dự án/Công việc",
    dataIndex: "name",
    key: "name",
    ellipsis: true,
  },
  {
    title: "Giá trị",
    dataIndex: "value",
    key: "value",
    align: "right",
    width: 100,
  },
]);

// Utility functions with comments
const getActionText = (actionKey) => {
  const map = {
    SUBMIT_CREATE: "Tạo & Gửi duyệt",
    SUBMIT_UPDATE: "Cập nhật & Gửi duyệt", // Hoặc chỉ 'Gửi duyệt lại'?
    APPROVE_SECTION: "Section Đã duyệt",
    REJECT_SECTION: "Section Đã từ chối",
    APPROVE_DEPT: "Department Đã duyệt",
    REJECT_DEPT: "Department Đã từ chối",
    APPROVE_MANAGER: "Manager/Admin Đã duyệt",
    REJECT_MANAGER : "Manager/Admin Đã từ chối",
    CREATE: "Tạo mới",
    UPDATE: "Cập nhật",
    DELETE: "Xóa",
  };
  return map[actionKey?.toUpperCase()] || actionKey || "Không rõ";
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return dayjs(dateString).format("YYYY-MM-DD HH:mm");
};

const truncateText = (text, length) => {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

const getValueStatusText = (status) => {
  return KpiValueStatusText[status] || status || "Không xác định";
};

const getValueStatusColor = (status) => {
  return KpiValueStatusColor[status] || "default";
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
/* Thêm CSS tùy chỉnh nếu cần */
.ant-table-actions {
  text-align: center;
}
:deep(.ant-alert-error) {
  margin-bottom: 10px;
}
</style>
