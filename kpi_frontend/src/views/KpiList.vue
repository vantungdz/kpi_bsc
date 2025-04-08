<template>
  <div class="kpi-list-page">
    <div class="list-header">

      <h2>KPI List</h2>
      <div class="action-buttons">
        <a-button type="primary" @click="$router.push({ name: 'KpiCreate' })" style="float: bottom;">
          <plus-outlined /> Create New KPI
        </a-button>
      </div>
    </div>

    <a-card style="background-color: #f8f9fa; height: 155px;">
      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item label="Search:">
            <a-input placeholder="KPI name..." v-model:value="localFilters.name" @pressEnter="applyFilters" />
          </a-form-item>
        </a-col>

        <a-col :span="6">
          <a-form-item label="Assigned To:">
            <a-input placeholder="Name..." v-model:value="localFilters.assignedToId" @pressEnter="applyFilters" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="21">
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
        <a-col :span="3" style="text-align: right;">
          <a-button type="primary" @click="applyFilters" :loading="loading">
            <template #icon><filter-outlined /></template>
            Apply
          </a-button>
          <a-button @click="resetFilters" :loading="loading" style="margin-left: 8px;">
            Reset
          </a-button>
        </a-col>
      </a-row>
    </a-card>

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

    <table>
      <thead>
        <tr>
          <th>No</th>
          <th @click="handleSort('name')" class="sortable">Name <i :class="sortIcon('name')"></i></th>
          <th>Hierarchy</th>
          <th>Perspective <i :class="sortIcon('perspective.name')"></i></th>
          <th>Unit</th>
          <th @click="handleSort('target')" class="sortable">Target <i :class="sortIcon('target')"></i>
          </th>
          <th>Weight</th>
          <th>Department</th>
          <th @click="handleSort('assignedTo.first_name')" class="sortable">Assigned To <i
              :class="sortIcon('assignedTo.first_name')"></i></th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(kpi, index) in kpis" :key="kpi.id">
          <td>{{ (index + 1) }}</td>
          <td>{{ kpi.name }}</td>
          <td class="kpi-hierarchy">{{ kpiHierarchyString(kpi) }}</td>
          <td>{{ kpi.perspective?.name || '-' }}</td>
          <td>{{ kpi.unit }}</td>
          <td>{{ formatValue(kpi.target, kpi.unit) }}</td>
          <td>{{ kpi.weight || 0 }}%</td>
          <td>{{ kpi.department?.name }}</td>
          <td>{{ (kpi.assignedTo?.first_name + ' ' + kpi.assignedTo?.last_name) || '--' }}</td>
          <td>{{ kpi.status }}</td>
          <td class="kpi-actions">
            <a-button type="default" @click="$router.push({ name: 'KpiDetail', params: { id: kpi.id } })">
              <schedule-outlined /> Details
            </a-button>
            <a-button ghost type="primary" @click="$router.push({ name: 'KpiDetail', params: { id: kpi.id } })">
              <edit-outlined /> Update
            </a-button>

            <a-button danger @click="showConfirmDeleteDialog(kpi.id, kpi.name)">
              <delete-outlined /> Delete
            </a-button>

          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination-controls" v-if="pagination.totalPages > 1">
      <span>Page {{ pagination.currentPage }} of {{ pagination.totalPages }} (Total: {{ pagination.totalItems
      }})</span>
      <button @click="changePage(pagination.currentPage - 1)" :disabled="pagination.currentPage <= 1">
        <i class="fas fa-chevron-left"></i> Prev
      </button>
      <button v-for="page in visiblePages" :key="page" @click="changePage(page)"
        :class="{ 'active': page === pagination.currentPage }" :disabled="page === '...'">
        {{ page }}
      </button>

      <button @click="changePage(pagination.currentPage + 1)"
        :disabled="pagination.currentPage >= pagination.totalPages">
        Next <i class="fas fa-chevron-right"></i>
      </button>
    </div>

    <a-modal danger v-model:open="isDeleteModalVisible" title="Confirm Dialog" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
      <p>Are you sure to delete "{{ selectedKpiName }}"?</p>
    </a-modal>
  </div>
</template>

<script setup>

import { reactive, computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { PlusOutlined, ScheduleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue';

// --- Store  ---
const store = useStore();

// --- Local State for Filters & Sorting ---
const localFilters = reactive({
  name: '',
  perspectiveId: '',
  departmentId: '',
  assignedToId: '',
  status: '',
  startDate: '',
  endDate: '',
});
const sortOptions = reactive({
  sortBy: 'name', // Cột sắp xếp mặc định
  sortOrder: 'ASC', // Thứ tự sắp xếp mặc định
});

// --- Computed Properties from Store ---
const kpis = computed(() => store.getters['kpis/kpiList'] || []);
const perspectiveList = computed(() => store.getters['perspectives/perspectiveList'] || []);
const departmentList = computed(() => store.getters['departments/departmentList'] || []);

const loading = computed(() => store.getters['kpis/isLoading']);
const error = computed(() => store.getters['kpis/error']);
const pagination = computed(() => store.getters['kpis/pagination']);
// const currentUserRole = computed(() => store.getters['auth/userRole']); // Lấy role user hiện tại

// Quyền tạo KPI (ví dụ đơn giản)
// const canCreateKpi = computed(() => ['admin', 'manager', 'leader'].includes(currentUserRole.value));
const canCreateKpi = 1; // computed(() => ['admin', 'manager', 'leader'].includes('admin'));
const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
console.log('canCreateKpi', canCreateKpi);

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
    departmentId: localFilters.departmentId || undefined,
    assignedToId: localFilters.assignedToId || undefined,
    status: localFilters.status || undefined,
    startDate: localFilters.startDate ? localFilters.startDate.toISOString() : undefined,
    endDate: localFilters.endDate ? localFilters.endDate.toISOString() : undefined,
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
  localFilters.assignedToId = null;
  localFilters.status = '';
  localFilters.startDate = '';
  localFilters.endDate = '';
  loadKpis(1);
};

// Xử lý thay đổi trang
const changePage = (page) => {
  if (page > 0 && page <= pagination.value.totalPages) {
    loadKpis(page);
  }
};

// Xử lý sắp xếp
const handleSort = (field) => {
  if (sortOptions.sortBy === field) {
    // Đảo chiều sắp xếp nếu click lại cùng cột
    sortOptions.sortOrder = sortOptions.sortOrder === 'ASC' ? 'DESC' : 'ASC';
  } else {
    // Sắp xếp theo cột mới, mặc định là ASC
    sortOptions.sortBy = field;
    sortOptions.sortOrder = 'ASC';
  }
  loadKpis(1); // Tải lại từ trang 1 khi đổi sắp xếp
};

// Hiển thị icon sắp xếp
const sortIcon = (field) => {
  if (sortOptions.sortBy !== field) {
    return 'fas fa-sort'; // Icon mặc định
  }
  return sortOptions.sortOrder === 'ASC' ? 'fas fa-sort-up' : 'fas fa-sort-down';
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
      // loadKpis(pagination.value.currentPage); // Tải lại trang hiện tại sau khi xóa
      console.log(`KPI ${selectedKpiName.value} deleted successfully.`);
      // Mutation REMOVE_KPI đã cập nhật store nên list tự cập nhật
      // Kiểm tra nếu trang hiện tại trống sau khi xóa thì lùi về trang trước
      // if (kpis.value.length === 0 && pagination.value.currentPage > 1) {
      //   changePage(pagination.value.currentPage - 1);
      // }
      deletedKpiName.value = selectedKpiName.value;
      isDeleteModalVisible.value = false;
      selectedKpiId.value = '';
      selectedKpiName.value = '';
      loadKpis(1);
    })
    .catch(err => {
      alert(`Delete failed KPI: ${store.getters['kpis/error'] || 'Unknown error'}`);
      console.error('Delete KPI error:', err);
    });
};

// Hàm tạo chuỗi phân cấp (cần logic phức tạp hơn nếu API không trả về sẵn)
const kpiHierarchyString = (kpi) => {
  // Giả sử API trả về kpi.hierarchy là chuỗi sẵn hoặc kpi.path là LTREE
  if (kpi.hierarchy) return kpi.hierarchy;
  if (kpi.path) return String(kpi.path).replace(/_/g, ' > '); // Ví dụ xử lý path LTREE
  return kpi.name; // Fallback
};

// Helper định dạng giá trị (nên đưa ra file utils)
const formatValue = (value, unit) => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (isNaN(num)) return '--';
  if (unit === '$') return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (unit === '%') return num.toFixed(1) + '%';
  return num.toLocaleString();
};


// --- Pagination Logic (Ví dụ đơn giản) ---
const visiblePages = computed(() => {
  const total = pagination.value.totalPages;
  const current = pagination.value.currentPage;
  const delta = 1; // Số trang hiển thị ở mỗi bên của trang hiện tại
  const range = [];
  const rangeWithDots = [];
  let l;

  range.push(1); // Luôn hiển thị trang 1
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  if (total > 1) range.push(total); // Luôn hiển thị trang cuối

  range.forEach((i) => {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1); // Thêm trang bị thiếu nếu chỉ cách 1
      } else if (i - l !== 1) {
        rangeWithDots.push('...'); // Thêm dấu ... nếu cách xa
      }
    }
    rangeWithDots.push(i);
    l = i;
  });

  return rangeWithDots;
});

// --- Lifecycle Hook ---
onMounted(async () => {
  try {
    loadKpis();
    // await store.dispatch('users/fetchUsers');
    await store.dispatch('perspectives/fetchPerspectives');
    await store.dispatch('departments/fetchDepartments');

    console.log('kpis', kpis);
    console.log('perspectiveList', perspectiveList);
  } catch (err) {
    error.value = err.message || 'Failed to fetch items';
  } finally {
    loading.value = false;
  }
});

</script>

<style scoped>
/* Kế thừa style chung */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}


.filter-actions {
  display: flex;
  justify-content: flex-end;
  /* Aligns items to the right */
  gap: 15px;
  /* Optional: Adds spacing between buttons */
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 15px;
  /* Khoảng cách giữa các item */
  margin-bottom: 1.5rem;
  background-color: #adb5bd;
}

.table-container {
  overflow-x: auto;
  /* Cho phép cuộn ngang nếu bảng quá rộng */
}

table th.sortable {
  cursor: pointer;
}

table th.sortable:hover {
  background-color: #e9ecef;
}

table th i.fa-solid {
  margin-left: 5px;
  color: #adb5bd;
  font-size: 0.8em;
}

/* Style icon sort */
table th i.fa-sort-up,
table th i.fa-sort-down {
  color: #343a40;
}

.kpi-hierarchy {
  font-size: 0.85em;
  color: #6c757d;
}

.kpi-actions button {
  font-size: 0.8em;
  padding: 3px 6px;
  margin-right: 3px;
}

.btn-view {
  background-color: #0dcaf0;
  color: #000;
  border-color: #0dcaf0;
}

.btn-view i,
.btn-edit i,
.btn-delete i {
  margin-right: 3px;
}

.pagination-controls {
  margin-top: 1.5rem;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.pagination-controls span {
  margin-right: 15px;
  font-size: 0.9em;
  color: #6c757d;
}

.pagination-controls button {
  margin-left: 5px;
  padding: 5px 10px;
  font-size: 0.9em;
}

.pagination-controls button.active {
  background-color: #0d6efd;
  color: white;
  border-color: #0d6efd;
  font-weight: bold;
}

.pagination-controls button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}


.loading-state,
.error-state,
.no-data-state {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  background-color: #f8f9fa;
  border: 1px dashed #dee2e6;
  border-radius: 4px;
  margin-top: 10px;
}

.loading-state i,
.error-state i,
.no-data-state i {
  margin-right: 8px;
  font-size: 1.1em;
}

.error-state {
  color: #dc3545;
  background-color: #f8d7da;
  border-color: #f5c2c7;
}
</style>