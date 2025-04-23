<template>
  <div class="kpi-company-list-page">
    <div class="list-header">
      <h2>Company KPI List</h2>
      <div class="action-buttons">
        <a-button type="primary" @click="goToCreateKpi" style="float: bottom;" v-if="canCreateCompanyKpi">
          <plus-outlined /> Create New KPI
        </a-button>
      </div>
    </div>

    <div class="filter-controls">
      <a-row :gutter="[22]">
        <a-col :span="6">
          <a-form-item label="Search:">
            <a-input placeholder="KPI name..." v-model:value="localFilters.name" @pressEnter="applyFilters" />
          </a-form-item>
        </a-col>
        <a-col :span="5">
          <a-form-item label="Department:">
            <a-select v-model:value="localFilters.departmentId" style="width: 100%;">
              <a-select-option value="">All</a-select-option>
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="Start Date:">
            <a-date-picker v-model:value="localFilters.startDate" style="width: 100%;" />
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item label="End Date:">
            <a-date-picker v-model:value="localFilters.endDate" style="width: 100%;" />
          </a-form-item>
        </a-col>
        <a-col :span="5" style="text-align: right;">
          <a-button type="primary" @click="applyFilters" :loading="loading">
            <template #icon><filter-outlined /></template> Apply
          </a-button>
          <a-button @click="resetFilters" :loading="loading" style="margin-left: 8px;">
            <template #icon><reload-outlined /></template> Reset
          </a-button>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px;">
      <a-alert v-if="loading" message="Loading KPIs..." type="info" show-icon> <template #icon> <a-spin /> </template>
      </a-alert>
      <a-alert v-else-if="error" :message="error" type="error" show-icon closable />
      <a-alert v-else-if="kpis.length === 0" message="No KPIs found matching your criteria." type="warning" show-icon
        closable />
      <a-alert v-if="deletedKpiName" :message="`KPI '${deletedKpiName}' was deleted successfully!`" type="success"
        closable @close="deletedKpiName = null" show-icon />
    </div>

    <div v-if="groupedKpis" class="data-container">
      <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end">
        <a-collapse-panel v-for="(kpiList, perspectiveId) in groupedKpis" :key="perspectiveId"
          :header="`${kpiList[0]?.perspective?.id || perspectiveId}. ${kpiList[0]?.perspective?.name || 'Uncategorized'} (${kpiList ? kpiList.length : 0} KPIs)`"
          accordion>
          <div v-if="kpiList && kpiList.length > 0">
            <a-table :columns="columns" :data-source="kpiList" row-key="id" :pagination="false" :size="'small'"
              bordered>
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'department'"> {{ record.department?.name || '--' }} </template>
                <template v-else-if="column.dataIndex === 'section'"> {{ record.section?.name || '--' }} </template>
                <template v-else-if="column.dataIndex === 'assignedTo'"> {{ record.assignedTo ?
                  `${record.assignedTo.first_name || ''} ${record.assignedTo.last_name || ''}`.trim() : '--' }}
                </template>
                <template v-else-if="column.dataIndex === 'status'"> <a-tag :bordered="false"
                    :color="getStatusColor(record.status)"> {{ record.status }} </a-tag> </template>
                <template v-else-if="column.dataIndex === 'action'">
                  <a-space> <a-button type="default" size="small" class="kpi-actions-button"
                      @click="goToDetail(record)"> <schedule-outlined /> Details </a-button>
                    <a-button danger size="small" class="kpi-actions-button" v-if="canDeleteCompanyKpi"
                      @click="showConfirmDeleteDialog(record.id, record.name)"> <delete-outlined /> Delete </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
          <span v-else>No KPIs found for this perspective.</span>
        </a-collapse-panel>
      </a-collapse>
    </div>
    <a-empty v-else-if="!loading && !error" description="No KPIs found." /> <a-modal danger
      v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
      <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
// Import Ant Design và Icons
import { Button as AButton, Input as AInput, Select as ASelect, SelectOption as ASelectOption, DatePicker as ADatePicker, Row as ARow, Col as ACol, FormItem as AFormItem, Alert as AAlert, Spin as ASpin, Collapse as ACollapse, CollapsePanel as ACollapsePanel, Table as ATable, Tag as ATag, Space as ASpace, Modal as AModal, Empty as AEmpty } from 'ant-design-vue';
import { PlusOutlined, FilterOutlined, ReloadOutlined, ScheduleOutlined, DeleteOutlined, notification } from '@ant-design/icons-vue';
import dayjs from 'dayjs'; // Import dayjs nếu dùng formatValue

// --- Store & Router ---
const store = useStore();
const router = useRouter();

// --- State ---
const localFilters = reactive({ name: '', departmentId: '', status: '', startDate: null, endDate: null }); // Dùng null cho date picker
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const activePanelKeys = ref([]); // Cho collapse

// --- Computed Properties ---
const loading = computed(() => store.getters['kpis/isLoading']); // Lấy từ store kpis
const error = computed(() => store.getters['kpis/error']); // Lấy từ store kpis
const kpis = computed(() => store.getters['kpis/kpiList'] || []); // Lấy từ store kpis
const departmentList = computed(() => store.getters['departments/departmentList'] || []); // Lấy từ store departments

// Gom nhóm KPI theo Perspective ID
const groupedKpis = computed(() => {
  const grouped = {};
  if (!kpis.value || kpis.value.length === 0) return grouped;
  kpis.value.forEach(kpi => {
    // Đảm bảo perspective_id tồn tại và là key hợp lệ
    const key = kpi.perspective?.id || 'uncategorized'; // Dùng ID từ object perspective lồng nhau
    if (!grouped[key]) { grouped[key] = []; }
    grouped[key].push(kpi);
  });
  return grouped;
});

// === Lấy Role và Định nghĩa Quyền ===
const effectiveRole = computed(() => store.getters['auth/effectiveRole']);

// Quyền tạo KPI Company (Admin, Company)
const canCreateCompanyKpi = computed(() => ['admin', 'manager'].includes(effectiveRole.value));
// Quyền xóa KPI Company (Admin, Company) - Giả định đơn giản
const canDeleteCompanyKpi = computed(() => ['admin', 'manager'].includes(effectiveRole.value));
// ====================================

// --- Table Columns ---
const columns = [
  { title: 'KPI name', dataIndex: 'name', key: 'name', width: '20%', ellipsis: true }, // Tăng width, thêm ellipsis
  { title: 'Department', dataIndex: 'department', key: 'department', width: '12%', ellipsis: true },
  { title: 'Section', dataIndex: 'section', key: 'section', width: '12%', ellipsis: true },
  { title: 'Assigned To', dataIndex: 'assignedTo', key: 'assignedTo', width: '12%', ellipsis: true },
  { title: 'Target', dataIndex: 'target', key: 'target', width: '8%', align: 'right' },
  { title: 'Weight', dataIndex: 'weight', key: 'weight', width: '7%', align: 'right' },
  // { title: 'Start Date', dataIndex: 'start_date', key: 'start_date', width: '8%' }, // Có thể ẩn bớt cột
  // { title: 'End Date', dataIndex: 'end_date', key: 'end_date', width: '8%' },
  { title: 'Frequency', dataIndex: 'frequency', key: 'frequency', width: '8%' },
  { title: 'Status', dataIndex: 'status', key: 'status', width: '8%', align: 'center' },
  { title: 'Action', dataIndex: 'action', key: 'action', width: '120px', align: 'center' } // Width cố định cho action
];

// --- Methods ---
const goToCreateKpi = () => { router.push({ name: 'KpiCreateCompany', query: { scope: 'company' } }) }; // Đảm bảo có route tên 'KpiCreate'

// Hàm gọi action fetchKpis từ store với các tham số filter
const loadKpis = (page = 1) => { // Thêm tham số page nếu API hỗ trợ phân trang
  const params = {
    scope: 'company', // Luôn lấy scope company cho trang này
    page: page,
    // limit: 10, // Số lượng item mỗi trang nếu có phân trang
  };
  // Thêm filter nếu có giá trị
  if (localFilters.name) params.search = localFilters.name; // API dùng 'search' hay 'name'?
  if (localFilters.departmentId) params.department_id = localFilters.departmentId;
  if (localFilters.status) params.status = localFilters.status;
  if (localFilters.startDate) params.start_date = dayjs(localFilters.startDate).format('YYYY-MM-DD'); // Format date
  if (localFilters.endDate) params.end_date = dayjs(localFilters.endDate).format('YYYY-MM-DD');

  store.dispatch('kpis/fetchKpis', params);
};

const applyFilters = () => { loadKpis(1); };
const resetFilters = () => { localFilters.name = ''; localFilters.departmentId = ''; localFilters.status = ''; localFilters.startDate = null; localFilters.endDate = null; loadKpis(1); };

// Xử lý xóa KPI
const showConfirmDeleteDialog = (id, name) => { isDeleteModalVisible.value = true; selectedKpiId.value = id; selectedKpiName.value = name; };
const handleDeleteKpi = async () => { // Dùng async/await
  if (!selectedKpiId.value) return;
  const kpiNameToDelete = selectedKpiName.value; // Lưu lại tên để hiển thị thông báo
  isDeleteModalVisible.value = false;
  // Không cần set loading = true ở đây vì store kpis đã quản lý loading riêng
  try {
    await store.dispatch('kpis/deleteKpi', selectedKpiId.value);
    deletedKpiName.value = kpiNameToDelete; // Hiển thị alert thành công
    selectedKpiId.value = null; selectedKpiName.value = null;
    // Tải lại trang hiện tại sau khi xóa (hoặc trang 1 nếu muốn)
    // loadKpis(store.getters['kpis/pagination']?.currentPage || 1); // Cần getter pagination
    loadKpis(1); // Tạm thời luôn về trang 1
  } catch (err) {
    const errorMsg = store.getters['kpis/error'] || 'Unknown error during deletion.';
    notification.error({ message: 'Delete Failed', description: errorMsg });
    console.error('Delete KPI error:', err);
  }
  // Loading sẽ tự tắt bởi action deleteKpi
};

// Hàm format ngày tháng (ví dụ)
// const formatValue = (value, formatType) => {
//  if (value === null || value === undefined) return '--';
//  if (formatType === 'date') { return dayjs(value).format('YYYY-MM-DD'); } // Ví dụ format
//  // ... các format khác ...
//  return value;
// };

// Watcher để tự động mở các panel trong collapse
watch(groupedKpis, (newGroups) => {
  if (newGroups && typeof newGroups === 'object') {
    activePanelKeys.value = Object.keys(newGroups);
  } else { activePanelKeys.value = []; }
}, { immediate: true });

// Hàm lấy màu status (tương tự các component khác)
const getStatusColor = (status) => { return status === 'Active' ? 'success' : 'red'; };

const goToDetail = (record) => {
  if (record && record.id) {
    // Từ trang Company List, thường sẽ điều hướng đến trang KpiDetail chung
    // Hoặc bạn có thể quyết định route dựa trên loại KPI nếu cần
    router.push({ name: 'KpiDetail', params: { id: record.id } });
    // !!! Quan trọng: Đảm bảo bạn có route với name: 'KpiDetail' trong router/index.js
    // Hoặc thay bằng tên route detail phù hợp của bạn.
  } else {
    console.error("Cannot navigate to detail: Invalid record or missing ID", record);
    notification.error({ message: "Cannot view details for this item." });
  }
};

// --- Lifecycle Hook ---
onMounted(async () => {
  // Fetch dữ liệu cần thiết khi component được tạo
  await loadKpis(); // Load KPIs ban đầu
  // Fetch các danh sách cho filter
  // await store.dispatch('perspectives/fetchPerspectives'); // Có thể không cần nếu đã load ở App.vue
  await store.dispatch('departments/fetchDepartments'); // Cần cho filter
  // await store.dispatch('sections/fetchSections'); // Có thể không cần cho trang company
});

</script>

<style scoped></style>
