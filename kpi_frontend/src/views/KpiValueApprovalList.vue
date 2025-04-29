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
                 <span>{{ record.kpiAssignment?.kpi?.name || 'N/A' }}</span>
              </a-tooltip>
            </template>

            <template v-else-if="column.key === 'employee'">
               <span>
                {{ record.kpiAssignment?.employee?.first_name || '' }}
                {{ record.kpiAssignment?.employee?.last_name || '' }}
                ({{ record.kpiAssignment?.employee?.username || 'N/A' }})
              </span>
            </template>

            <template v-else-if="column.key === 'value'">
               {{ record.value?.toLocaleString() ?? 'N/A' }}
               <span v-if="record.kpiAssignment?.kpi?.unit"> {{ record.kpiAssignment.kpi.unit }}</span>
             </template>

             <template v-else-if="column.key === 'target'">
                <span v-if="record.kpiAssignment?.targetValue !== null && record.kpiAssignment?.targetValue !== undefined">
                    {{ record.kpiAssignment.targetValue?.toLocaleString() }}
                    <span v-if="record.kpiAssignment?.kpi?.unit"> {{ record.kpiAssignment.kpi.unit }}</span>
                </span>
                <span v-else>N/A</span>
            </template>

            <template v-else-if="column.key === 'submittedAt'">
               {{ formatDate(record.timestamp || record.updated_at || record.created_at) }}
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

        <a-empty v-if="!loadingError && pendingItems.length === 0" description="Không có mục nào đang chờ duyệt." />

      </a-spin>
    </a-card>

    <a-modal
      :open="isRejectModalVisible"
      title="Lý do từ chối"
      @ok="handleReject"
      @cancel="closeRejectModal"
      :confirm-loading="isProcessing && currentActionItemId === itemToReject?.id"
      ok-text="Xác nhận Từ chối"
      cancel-text="Hủy"
      :maskClosable="false"
      destroyOnClose
    >
       <a-alert
          v-if="rejectError"
          :message="rejectError"
          type="error"
          show-icon
          style="margin-bottom: 10px"
        />
      <p v-if="itemToReject" style="margin-bottom: 10px;">
        Từ chối giá trị <strong>{{ itemToReject.value?.toLocaleString() }}</strong> cho KPI
        <strong>"{{ itemToReject.kpiAssignment?.kpi?.name }}"</strong> của nhân viên
        <strong>{{ itemToReject.kpiAssignment?.employee?.first_name }} {{ itemToReject.kpiAssignment?.employee?.last_name }}</strong>?
      </p>
      <a-form-item label="Lý do (bắt buộc):" :validate-status="rejectError ? 'error' : ''" :help="rejectError">
          <a-textarea
            v-model:value="rejectionReason"
            placeholder="Nhập lý do từ chối..."
            :rows="4"
          />
      </a-form-item>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import {
  Table as ATable,
  Button as AButton,
  Space as ASpace,
  Modal as AModal,
  Textarea as ATextarea,
  FormItem as AFormItem, // Import FormItem
  Card as ACard,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  Tag as ATag, // Import Tag
  Tooltip as ATooltip,
  notification,
} from 'ant-design-vue';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import { KpiValueStatus, KpiValueStatusText, KpiValueStatusColor } from '../constants/kpiStatus'; // Import các hằng số trạng thái KPI

const store = useStore();
// --- State Nội bộ ---
const pendingItems = ref([]);
const isLoadingPending = ref(false);
const loadingError = ref(null);
const isRejectModalVisible = ref(false);
const itemToReject = ref(null);
const rejectionReason = ref('');
const rejectError = ref(null);
const currentActionItemId = ref(null);

// --- State/Getters từ Vuex ---
const isProcessing = computed(() => store.getters['kpiValues/isProcessingApproval']);
const currentUser = computed(() => store.getters['auth/user']);

const cardTitle = computed(() => {
  const role = currentUser.value?.role;
  if (role === 'admin') return 'Quản lý Phê duyệt Giá trị KPI (Admin)';
  if (role === 'manager') return 'Giá trị KPI chờ Manager/Department duyệt';
  if (role === 'leader') return 'Giá trị KPI chờ Section duyệt';
  return 'Danh sách chờ duyệt';
});

// --- Định nghĩa Cột Bảng ---
const columns = ref([ // Dùng ref nếu cấu trúc cột có thể thay đổi động
  { title: 'Tên KPI', dataIndex: ['kpiAssignment', 'kpi', 'name'], key: 'kpiName', width: 200, ellipsis: true },
  { title: 'Nhân viên', key: 'employee', width: 150, ellipsis: true },
  { title: 'Giá trị Nộp', dataIndex: 'value', key: 'value', align: 'right', width: 120 },
  { title: 'Target', dataIndex: ['kpiAssignment', 'targetValue'], key: 'target', align: 'right', width: 120 },
  { title: 'Ngày Submit', dataIndex: 'timestamp', key: 'submittedAt', width: 140 }, // Hoặc updated_at?
  { title: 'Ghi chú', dataIndex: 'notes', key: 'notes', width: 150, ellipsis: true },
   { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 180, align: 'center' },
  { title: 'Hành động', key: 'actions', align: 'center', width: 180, fixed: 'right' },
]);

// --- Hàm Helpers ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return dayjs(dateString).format('YYYY-MM-DD HH:mm');
};

const truncateText = (text, length) => {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
};

const getValueStatusText = (status) => {
    return KpiValueStatusText[status] || status || 'Không xác định';
};

const getValueStatusColor = (status) => {
     return KpiValueStatusColor[status] || 'default';
};


// --- Hàm Fetch Dữ liệu ---
const fetchData = async () => {
  // Kiểm tra user có tồn tại không
  if (!currentUser.value || !currentUser.value.id) {
      loadingError.value = "Không thể xác định người dùng.";
      return;
  }
  // Không cần kiểm tra role ở đây nữa, backend sẽ xử lý
  isLoadingPending.value = true;
  loadingError.value = null;
  const fetchAction = 'kpiValues/fetchPendingApprovals'; // Chỉ cần 1 action fetch

  try {
    const data = await store.dispatch(fetchAction); // Backend tự lọc dựa trên user
    pendingItems.value = data || [];
    console.log("Fetched pending items: ", pendingItems.value);
  } catch (error) {
    loadingError.value = store.getters['kpiValues/getPendingError'] || 'Lỗi khi tải danh sách chờ duyệt.';
    pendingItems.value = [];
    console.error("Fetch pending error:", error);
  } finally {
    isLoadingPending.value = false;
  }
};

// --- Hàm Xử lý Approve ---
const handleApprove = async (valueId) => {
  if (!valueId) return;
  const item = pendingItems.value.find(p => p.id === valueId); // Tìm item trong danh sách hiện tại
  if (!item) return;

  currentActionItemId.value = valueId;
  let actionName = null;
  console.log(`Item Status to Approve: ${item.status}`);
  // Quyết định action dựa trên *trạng thái của item*
  switch (item.status) {
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
      actionName = 'kpiValues/approveValueSection';
      break;
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
      actionName = 'kpiValues/approveValueDept';
      break;
    case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      actionName = 'kpiValues/approveValueManager';
      break;
    default:
       notification.error({ message: 'Lỗi', description: `Trạng thái '${item.status}' không hợp lệ để phê duyệt.` });
       currentActionItemId.value = null;
       return;
  }
  console.log(`Dispatching Vuex Action: ${actionName} for valueId: ${valueId}`);
  try {
    await store.dispatch(actionName, { valueId });
    await fetchData(); // Fetch lại danh sách sau khi thành công
  } catch (error) {
    console.error(`Lỗi khi thực hiện ${actionName}:`, error);
    // Notification lỗi đã được hiển thị trong action Vuex
  } finally {
     currentActionItemId.value = null;
  }
};

// --- Hàm Xử lý Reject ---
const openRejectModal = (item) => {
   if (!item || item.id === undefined) return;
   // Kiểm tra trạng thái hợp lệ trước khi mở modal
   if (![KpiValueStatus.PENDING_SECTION_APPROVAL, KpiValueStatus.PENDING_DEPT_APPROVAL, KpiValueStatus.PENDING_MANAGER_APPROVAL].includes(item.status)){
        notification.warn({message: 'Trạng thái không hợp lệ', description: 'Không thể từ chối mục ở trạng thái này.'});
        return;
   }
  itemToReject.value = item;
  rejectionReason.value = '';
  rejectError.value = null;
  isRejectModalVisible.value = true;
};

const closeRejectModal = () => {
  isRejectModalVisible.value = false;
  // Không reset itemToReject ngay để modal kịp đóng hiệu ứng
  setTimeout(() => {
    itemToReject.value = null;
    rejectionReason.value = '';
    rejectError.value = null;
    currentActionItemId.value = null; // Reset ID khi đóng modal
  }, 300);
};

const handleReject = async () => {
  if (!rejectionReason.value || rejectionReason.value.trim() === '') {
     rejectError.value = 'Vui lòng nhập lý do từ chối.';
     return;
  }
   if (!itemToReject.value) return;

  const valueId = itemToReject.value.id;
  const currentStatus = itemToReject.value.status; // Lấy trạng thái hiện tại của item
  currentActionItemId.value = valueId;
  rejectError.value = null;

   let actionName = null;
   // Quyết định action dựa trên *trạng thái của item*
   switch (currentStatus) {
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
        actionName = 'kpiValues/rejectValueSection';
        break;
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        actionName = 'kpiValues/rejectValueDept';
        break;
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        actionName = 'kpiValues/rejectValueManager';
        break;
      default:
         notification.error({ message: 'Lỗi', description: `Trạng thái '${currentStatus}' không hợp lệ để từ chối.` });
         currentActionItemId.value = null; // Reset loading trên nút modal
         // Không đóng modal ngay để user thấy lỗi
         rejectError.value = `Trạng thái '${currentStatus}' không hợp lệ để từ chối.`;
         return;
    }

  try {
    await store.dispatch(actionName, { valueId, reason: rejectionReason.value });
    closeRejectModal();
    await fetchData(); // Fetch lại danh sách sau khi thành công
  } catch (error) {
     rejectError.value = store.getters['kpiValues/getApprovalError'] || 'Lỗi khi thực hiện từ chối.';
    console.error(`Lỗi khi thực hiện ${actionName}:`, error);
  } finally {
      // Giữ loading nếu có lỗi để user biết action đã chạy xong (thất bại)
      if (!rejectError.value) {
         currentActionItemId.value = null; // Chỉ reset nếu thành công (vì modal sẽ đóng)
      }
       // Nếu muốn tắt loading ngay cả khi lỗi: currentActionItemId.value = null;
  }
};

// --- Fetch dữ liệu khi component được mount ---
onMounted(() => {
    if (currentUser.value && currentUser.value.id) { // Chỉ fetch nếu có user
        fetchData();
    } else {
         loadingError.value = "Không thể xác định thông tin người dùng để tải dữ liệu.";
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