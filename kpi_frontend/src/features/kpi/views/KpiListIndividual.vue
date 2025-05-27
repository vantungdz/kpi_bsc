<template>
  <div class="kpi-list-page">
    <div class="list-header">
      <h2>Individual KPI List</h2>
      <div class="action-buttons">
        <a-button type="primary" @click="goToCreateKpi" style="float: bottom;" v-if="canCreateKpiPersonal">
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
        <a-col :span="4">
          <a-form-item label="Status:">
            <a-select v-model:value="localFilters.status" style="width: 100%;">
              <a-select-option value="">All</a-select-option>
              <a-select-option value="Met">Met</a-select-option>
              <a-select-option value="Not Met">Not Met</a-select-option>
              <a-select-option value="Exceeded">Exceeded</a-select-option>
              <a-select-option value="In Progress">In Progress</a-select-option>
              <a-select-option value="Not Started">Not Started</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="[22]" style="padding: 0px;">
        <a-col :span="6">
          <a-form-item label="Assigned To:">
            <a-input placeholder="Name..." v-model:value="localFilters.assignedToName" @pressEnter="applyFilters" />
          </a-form-item>
        </a-col>
        <a-col :span="5">
          <a-form-item label="Perspective:">
            <a-select v-model:value="localFilters.perspectiveId" style="width: 100%;">
              <a-select-option value="">All</a-select-option>
              <a-select-option v-for="perspective in perspectiveList" :key="perspective.id" :value="perspective.id">
                {{ perspective.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="4">
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
          <a-form-item label="Section:">
            <a-select v-model:value="localFilters.sectionId" style="width: 100%;">
              <a-select-option value="">All</a-select-option>
              <a-select-option v-for="section in sectionList" :key="section.id" :value="section.id">
                {{ section.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="5" style="text-align: right;">
          <a-button type="primary" @click="applyFilters" :loading="loading">
            <template #icon><filter-outlined /></template>
            Apply
          </a-button>
          <a-button @click="resetFilters" :loading="loading" style="margin-left: 8px;">
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </a-col>
      </a-row>
    </div>

    <div style="margin-top: 20px; margin-bottom: 20px;">
      <a-alert v-if="loading" message="Loading KPIs..." type="info" show-icon>
        <template #icon>
          <a-spin />
        </template>
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
          :header="`${kpiList[0].perspective_id}. ${kpiList[0].perspective.name} (${kpiList ? kpiList.length : 0} KPIs)`"
          accordion>
          <div v-if="kpiList.length > 0">
            <a-table :columns="columns" :data-source="kpiList" row-key="id" :pagination="false" :size="'small'"
              :rowClassName="(record) => record.isParent ? 'row-parent' : ''">
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'department'">
                  {{ record.department ? record.department.name : '--' }}
                </template>
                <template v-if="column.dataIndex === 'start_date'">
                  {{ record.start_date || '--' }}
                </template>
                <template v-if="column.dataIndex === 'end_date'">
                  {{ record.end_date || '--' }}
                </template>
                <template v-if="column.dataIndex === 'section'">
                  {{ record.section ? record.section.name : '--' }}
                </template>
                <template v-if="column.dataIndex === 'assignedTo'">
                  {{ record.assignedTo ? (record.assignedTo.first_name || '' + ' ' + record.assignedTo.last_name || '')
                    : '--' }}
                </template>
                <template v-if="column.dataIndex === 'status'">
                  <a-tag :bordered="false" :color="getStatusColor(record.status)">
                    {{ record.status }}
                  </a-tag>
                </template>
                <template v-if="column.dataIndex === 'action'">
                  <a-button type="default" class="kpi-actions-button"
                    @click="$router.push({ name: 'KpiDetail', params: { id: record.id } })">
                    <schedule-outlined /> Details
                  </a-button>
                  <a-button danger class="kpi-actions-button" @click="showConfirmDeleteDialog(record.id, record.name)" v-if="canDeleteKpiPersonal">
                    <delete-outlined /> Delete
                  </a-button>
                </template>
              </template>
            </a-table>
          </div>
          <span v-else>No KPIs found for this perspective.</span>
        </a-collapse-panel>

      </a-collapse>
    </div>
    <span v-else>No KPIs found.</span>

    <a-modal danger v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
      <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
    </a-modal>
  </div>
</template>

<script setup>

import { reactive, computed, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router'
import { PlusOutlined, FilterOutlined, ReloadOutlined, ScheduleOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import { KpiDefinitionStatus } from '@/core/constants/kpiStatus';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '@/core/constants/rbac.constants';

// --- Store  ---
const store = useStore();
const router = useRouter()

// --- Local State for Filters & Sorting ---
const localFilters = reactive({
  name: '',
  perspectiveId: '',
  sectionId: '',
  departmentId: '',
  assignedToName: '',
  status: '',
  startDate: '',
  endDate: '',
});
const sortOptions = reactive({
  sortBy: 'name', // Cột sắp xếp mặc định
  sortOrder: 'ASC', // Thứ tự sắp xếp mặc định
});

const columns = [
  { title: 'KPI name', dataIndex: 'name', key: 'name', width: '15%' },
  { title: 'Department', dataIndex: 'department', key: 'department', width: '10%' },
  { title: 'Section', dataIndex: 'section', key: 'section', width: '10%' },
  { title: 'Assigned To', dataIndex: 'assignedTo', key: 'assignedTo', width: '12%' },
  { title: 'Target', dataIndex: 'target', key: 'target' },
  { title: 'Weight', dataIndex: 'weight', key: 'weight' },
  { title: 'Start Date', dataIndex: 'start_date', key: 'start_date' },
  { title: 'End Date', dataIndex: 'end_date', key: 'end_date' },
  { title: 'Frequency', dataIndex: 'frequency', key: 'frequency' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Action', dataIndex: 'action', key: 'action', className: 'action-column-cell', width: '11%' }
];

// --- Computed Properties from Store ---
const kpis = computed(() => store.getters['kpis/kpiList'] || []);
const perspectiveList = computed(() => store.getters['perspectives/perspectiveList'] || []);
const departmentList = computed(() => store.getters['departments/departmentList'] || []);
const sectionList = computed(() => store.getters['sections/sectionList'] || []);

const loading = computed(() => store.getters['kpis/isLoading']);
const error = computed(() => store.getters['kpis/error']);
const pagination = computed(() => store.getters['kpis/pagination']);

const groupedKpis = computed(() => {
  const grouped = {};
  if (!kpis.value || kpis.value.length === 0) {
    return grouped; // Return empty object if no KPIs
  }
  kpis.value.forEach(kpi => {
    if (!grouped[kpi.perspective_id]) {
      grouped[kpi.perspective_id] = [];

    }
    grouped[kpi.perspective_id].push(kpi);
  });

  return grouped;
});

const userPermissions = computed(() => store.getters['auth/user']?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action === action && p.resource === resource
  );
}
const canCreateKpiPersonal = computed(() => hasPermission(RBAC_ACTIONS.CREATE, RBAC_RESOURCES.KPI_PERSONAL));
const canDeleteKpiPersonal = computed(() => hasPermission(RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI));

const canCreateKpi = 1; // computed(() => ['admin', 'manager', 'leader'].includes('admin'));
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
// const groupedKpis = ref(null);
console.log('canCreateKpi', canCreateKpi);
// --- Reactive State ---
const activePanelKeys = ref([]);

const goToCreateKpi = () => {
  router.push({ name: 'KpiCreate', query: { scope: 'company' } })
}

// --- Methods ---
// Hàm gọi action fetchKpis từ store với các tham số hiện tại
const loadKpis = (page = 1) => {
  // Chỉ gửi nếu có giá trị
  const params = {
    page,
    limit: pagination.value.itemsPerPage,
    sortBy: sortOptions.sortBy,
    sortOrder: sortOptions.sortOrder,
    name: localFilters.name || undefined,
    perspectiveId: localFilters.perspectiveId || undefined,
    sectionId: localFilters.sectionId || undefined,
    departmentId: localFilters.departmentId || undefined,
    assignedToName: localFilters.assignedToName || undefined,
    status: localFilters.status || undefined,
    startDate: localFilters.startDate ? formatValue(localFilters.startDate, 'date') : undefined,
    endDate: localFilters.endDate ? formatValue(localFilters.endDate, 'date') : undefined,
  };

  // Loại bỏ các key có giá trị undefined
  Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
  store.dispatch('kpis/fetchKpis', params);
};

// Áp dụng bộ lọc hiện tại và tải lại trang 1
const applyFilters = () => {
  console.log("applyFilters");
  loadKpis(1); // Luôn tải lại từ trang 1 khi lọc
};


// Reset bộ lọc về mặc định và tải lại
const resetFilters = () => {
  console.log("resetFilters");
  localFilters.name = '';
  localFilters.perspectiveId = null;
  localFilters.departmentId = null;
  localFilters.assignedToName = null;
  localFilters.status = '';
  localFilters.startDate = '';
  localFilters.endDate = '';
  loadKpis(1);
};

// Xử lý thay đổi trang
const changePage = (page) => {
  console.log('changePage', page, pagination.value);
  if (page > 0 && page <= pagination.value.totalPages) {
    loadKpis(page);
  }
};

// Xử lý xóa KPI
const showConfirmDeleteDialog = (id, name) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = id;
  selectedKpiName.value = name;
};

const handleDeleteKpi = () => {
  store.dispatch('kpis/deleteKpi', selectedKpiId.value)
    .then(() => {
      // Thành công: Có thể hiển thị thông báo nhẹ
      loadKpis(pagination.value.currentPage); // Tải lại trang hiện tại sau khi xóa
      // Mutation REMOVE_KPI đã cập nhật store nên list tự cập nhật
      // Kiểm tra nếu trang hiện tại trống sau khi xóa thì lùi về trang trước
      if (kpis.value.length === 0 && pagination.value.currentPage > 1) {
        changePage(pagination.value.currentPage - 1);
      }
      deletedKpiName.value = selectedKpiName.value;
      isDeleteModalVisible.value = false;
      selectedKpiId.value = '';
      selectedKpiName.value = '';
    })
    .catch(err => {
      console.error('Delete KPI error:', err);
    });
};

const formatValue = (value, unit) => {
  if (value === null || value === undefined) return '--';

  if (unit === 'date') {
    const date = new Date(value);
    return date.toISOString('YYYY/MM/DD').slice(0, 10);
  }

  const num = Number(value);
  if (isNaN(num)) return '--';
  if (unit === '$') return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (unit === '%') return num.toFixed(1) + '%';
  return num.toLocaleString();
};

// --- Watcher to set all keys active ---
watch(groupedKpis, (newGroups) => {
  if (newGroups && typeof newGroups === 'object') {
    const allKeys = Object.keys(newGroups);
    // Update the activePanelKeys ref with ALL the keys from the data
    activePanelKeys.value = allKeys;
  } else {
    activePanelKeys.value = []; // Clear if no groups
  }
}, {
  immediate: true // Run once immediately on component setup
});

const getStatusColor = (status) => {
  return status === KpiDefinitionStatus.APPROVED ? 'success' : 'red';
};

// --- Lifecycle Hook ---
onMounted(async () => {
  try {
    await loadKpis();
    await store.dispatch('perspectives/fetchPerspectives');
    await store.dispatch('departments/fetchDepartments');
    await store.dispatch('sections/fetchSections');
  } catch (err) {
    error.value = err.message || 'Failed to fetch items';
  } finally {
    loading.value = false;
  }
});

</script>

<style scoped></style>